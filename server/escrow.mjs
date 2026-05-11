// server/escrow.mjs
// Sol Skies — Devnet Escrow Manager
//
// Holds a server-side Solana keypair that acts as escrow.
// Enterprise deposits SOL → escrow on mission creation.
// Server pays operator from escrow on contract completion.
//
// Network: Devnet (free SOL via airdrop — no paywall)
//
// SECURITY: The keypair is loaded from ESCROW_SECRET_KEY (env). If unset, a
// fresh keypair is generated and persisted to server/.escrow-keypair.json
// (gitignored). NEVER commit a real private key to source. NEVER reuse this
// devnet key for mainnet — replace with an Anchor PDA escrow program first.

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KEYPAIR_FILE = path.join(__dirname, '.escrow-keypair.json');

// ─── Load or generate the escrow keypair ─────────────────────────────────────
function loadEscrowKeypair() {
  // 1. Prefer env var (production / shared deployments).
  const envSecret = process.env.ESCROW_SECRET_KEY;
  if (envSecret) {
    try {
      const arr = JSON.parse(envSecret);
      if (!Array.isArray(arr) || arr.length !== 64) {
        throw new Error('must be a JSON array of 64 bytes');
      }
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    } catch (e) {
      throw new Error(`Invalid ESCROW_SECRET_KEY: ${e.message}`);
    }
  }

  // 2. Fall back to a persisted file (gitignored — survives restarts).
  if (fs.existsSync(KEYPAIR_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(KEYPAIR_FILE, 'utf8'));
      return Keypair.fromSecretKey(Uint8Array.from(raw));
    } catch (e) {
      console.warn('[escrow] .escrow-keypair.json unreadable, regenerating:', e.message);
    }
  }

  // 3. Generate fresh and persist.
  const kp = Keypair.generate();
  fs.writeFileSync(KEYPAIR_FILE, JSON.stringify(Array.from(kp.secretKey)));
  console.warn(
    '[escrow] No ESCROW_SECRET_KEY set — generated a fresh devnet keypair.\n' +
    `         Address: ${kp.publicKey.toBase58()}\n` +
    `         Persisted to ${KEYPAIR_FILE} (gitignored).`
  );
  return kp;
}

export const escrowKeypair = loadEscrowKeypair();
export const ESCROW_ADDRESS = escrowKeypair.publicKey.toBase58();

// ─── Devnet connection ────────────────────────────────────────────────────────
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// ─── Airdrop helper — funds escrow on devnet (free) ──────────────────────────
export async function ensureEscrowFunded(minLamports = 0.05 * LAMPORTS_PER_SOL) {
  try {
    const balance = await connection.getBalance(escrowKeypair.publicKey);
    if (balance < minLamports) {
      console.log(`[escrow] Balance low (${balance} lamports), requesting airdrop…`);
      const sig = await connection.requestAirdrop(escrowKeypair.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, 'confirmed');
      const newBal = await connection.getBalance(escrowKeypair.publicKey);
      console.log(`[escrow] Airdrop confirmed. New balance: ${newBal / LAMPORTS_PER_SOL} SOL`);
      return newBal;
    }
    return balance;
  } catch (err) {
    console.warn('[escrow] Airdrop failed (rate-limited or offline):', err.message);
    return null;
  }
}

// ─── Get current escrow balance ───────────────────────────────────────────────
export async function getEscrowBalance() {
  try {
    const lamports = await connection.getBalance(escrowKeypair.publicKey);
    return { lamports, sol: lamports / LAMPORTS_PER_SOL };
  } catch (err) {
    console.error('[escrow] getBalance error:', err.message);
    return { lamports: 0, sol: 0 };
  }
}

// ─── Verify an inbound deposit ────────────────────────────────────────────────
// Checks that `txSignature` is a confirmed transfer of at least `expectedLamports`
// to the escrow address from `fromWallet`.
export async function verifyDeposit(txSignature, fromWallet, expectedLamports) {
  try {
    const tx = await connection.getParsedTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || tx.meta?.err) {
      return { ok: false, reason: 'Transaction not found or failed on-chain' };
    }

    const instructions = tx.transaction?.message?.instructions || [];
    let deposited = 0;

    for (const ix of instructions) {
      if (
        ix.program === 'system' &&
        ix.parsed?.type === 'transfer' &&
        ix.parsed?.info?.destination === ESCROW_ADDRESS
      ) {
        if (fromWallet && ix.parsed.info.source !== fromWallet) continue;
        deposited += ix.parsed.info.lamports || 0;
      }
    }

    if (deposited < expectedLamports) {
      return {
        ok: false,
        reason: `Expected ${expectedLamports} lamports, found ${deposited}`
      };
    }

    return { ok: true, deposited };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ─── Pay operator from escrow ─────────────────────────────────────────────────
// Signs a transfer from escrow keypair → operator wallet.
// Called by server when enterprise completes a contract.
export async function payOperator(operatorWallet, lamports) {
  try {
    await ensureEscrowFunded(lamports + 5000);

    const toPubkey = new PublicKey(operatorWallet);
    const { blockhash } = await connection.getLatestBlockhash('confirmed');

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: escrowKeypair.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: escrowKeypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [escrowKeypair], {
      commitment: 'confirmed',
    });

    console.log(`[escrow] Paid ${lamports / LAMPORTS_PER_SOL} SOL to ${operatorWallet}. Tx: ${signature}`);
    return { ok: true, signature, explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet` };
  } catch (err) {
    console.error('[escrow] payOperator error:', err.message);
    return { ok: false, reason: err.message };
  }
}

// ─── SOL ↔ Lamports helpers ───────────────────────────────────────────────────
export const solToLamports = (sol) => Math.round(parseFloat(sol) * LAMPORTS_PER_SOL);
export const lamportsToSol = (lamports) => lamports / LAMPORTS_PER_SOL;
