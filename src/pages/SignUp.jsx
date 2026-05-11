// src/pages/SignUp.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import logo from '../assets/AdobSOL.png';
import { useSession } from '../Context/sessionContext';
import { API_BASE, getSignupProof } from '../lib/api';

function SignUp() {
  const navigate = useNavigate();
  const { login } = useSession();
  const { publicKey, connected, disconnect, signMessage } = useWallet();
  const { setVisible } = useWalletModal();

  const [step, setStep] = useState(1); // 1: role, 2: details, 3: wallet
  const [role, setRole] = useState(''); // 'operator' or 'enterprise'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availability, setAvailability] = useState({
    username: { available: null, message: '' },
    companyName: { available: null, message: '' },
    wallet: { available: null, message: '' }
  });

  const [formData, setFormData] = useState({
    // Common fields
    fullName: '',

    // Operator-specific fields
    username: '',
    region: '',
    flightStack: '',
    autopilotHardware: '',
    vehicleType: '',
    firmwareVersion: '',
    communicationProtocol: 'mavlink',
    certifications: [],
    droneModel: '',
    experience: '',

    // Enterprise-specific fields
    legalName: '',
    businessType: '',
    yearEstablished: '',
    industry: '',
    operatingRegions: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    companyDescription: ''
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [certificationFiles, setCertificationFiles] = useState([]);
  const [droneImage, setDroneImage] = useState(null);
  const [droneImagePreview, setDroneImagePreview] = useState('');

  // Enterprise: business certificate upload
  const [businessCertFile, setBusinessCertFile] = useState(null);
  const [businessCertName, setBusinessCertName] = useState('');

  // Dynamic options based on flight stack selection
  const [autopilotOptions, setAutopilotOptions] = useState([]);

  // Countries list for region dropdown
  const countries = [
    "United States", "Canada", "Mexico", "United Kingdom", "Germany", "France",
    "Spain", "Italy", "Netherlands", "Belgium", "Switzerland", "Austria",
    "Sweden", "Norway", "Denmark", "Finland", "Ireland", "Portugal", "Greece",
    "Poland", "Czech Republic", "Hungary", "Australia", "New Zealand",
    "Japan", "South Korea", "China", "India", "Singapore", "Malaysia",
    "Thailand", "Vietnam", "Indonesia", "Philippines", "South Africa",
    "Nigeria", "Kenya", "Egypt", "Morocco", "UAE", "Saudi Arabia", "Israel",
    "Turkey", "Brazil", "Argentina", "Chile", "Colombia", "Peru", "Venezuela"
  ].sort();

  // Flight stack options
  const flightStacks = [
    { value: 'ardupilot', label: 'ArduPilot' },
    { value: 'px4', label: 'PX4' },
    { value: 'betaflight', label: 'Betaflight' },
    { value: 'inav', label: 'INAV' }
  ];

  // Autopilot hardware options
  const autopilotHardware = {
    ardupilot: [
      { value: 'pixhawk_4', label: 'Pixhawk 4' },
      { value: 'pixhawk_6x', label: 'Pixhawk 6X' },
      { value: 'cube_orange', label: 'Cube Orange' },
      { value: 'cube_black', label: 'Cube Black' },
      { value: 'cuav_v5', label: 'CUAV V5+' },
      { value: 'holybro_kakute', label: 'Holybro Kakute H7' }
    ],
    px4: [
      { value: 'pixhawk_4', label: 'Pixhawk 4' },
      { value: 'pixhawk_6x', label: 'Pixhawk 6X' },
      { value: 'cube_orange', label: 'Cube Orange' },
      { value: 'holbro_pix32', label: 'Holybro Pix32' }
    ],
    betaflight: [
      { value: 'matek', label: 'Matek Systems' },
      { value: 'holybro', label: 'Holybro' }
    ],
    inav: [
      { value: 'matek', label: 'Matek Systems' },
      { value: 'omnibus', label: 'Omnibus' }
    ]
  };

  // Vehicle types
  const vehicleTypes = [
    { value: 'multicopter', label: 'Multicopter' },
    { value: 'fixed_wing', label: 'Fixed Wing' },
    { value: 'vtol', label: 'VTOL' },
    { value: 'rover', label: 'Rover' },
    { value: 'boat', label: 'Boat' }
  ];

  // Experience levels
  const experienceLevels = [
    { value: 'beginner', label: 'Beginner (0-1 years)' },
    { value: 'intermediate', label: 'Intermediate (1-3 years)' },
    { value: 'advanced', label: 'Advanced (3-5 years)' },
    { value: 'expert', label: 'Expert (5+ years)' }
  ];

  // Business types
  const businessTypes = [
    { value: 'private', label: 'Private Company' },
    { value: 'public', label: 'Public Company' },
    { value: 'llc', label: 'LLC' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
    { value: 'nonprofit', label: 'Non-profit' },
    { value: 'government', label: 'Government Agency' }
  ];

  // Industries
  const industries = [
    { value: 'construction', label: 'Construction' },
    { value: 'infrastructure', label: 'Infrastructure Inspection' },
    { value: 'agriculture', label: 'Agriculture / Precision Farming' },
    { value: 'oil_gas', label: 'Oil & Gas' },
    { value: 'mining', label: 'Mining & Quarrying' },
    { value: 'real_estate', label: 'Real Estate Development' },
    { value: 'emergency', label: 'Emergency Services' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'telecom', label: 'Telecommunications' },
    { value: 'environmental', label: 'Environmental Monitoring' },
    { value: 'security', label: 'Security & Surveillance' },
    { value: 'media', label: 'Film & Media Production' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'research', label: 'Research & Academia' }
  ];

  // Certification bodies
  const certificationBodies = [
    { value: 'faas', label: 'FAA Part 107 (US)' },
    { value: 'easa', label: 'EASA (Europe)' },
    { value: 'caa', label: 'CAA (UK)' },
    { value: 'caac', label: 'CAAC (China)' },
    { value: 'casa', label: 'CASA (Australia)' },
    { value: 'transport_canada', label: 'Transport Canada' }
  ];

  // Check wallet when connected - redirect if already registered
  useEffect(() => {
    const checkWallet = async () => {
      if (connected && publicKey) {
        try {
          const response = await fetch(`${API_BASE}/api/check/wallet?wallet=${publicKey.toBase58()}`);
          const data = await response.json();
          setAvailability(prev => ({
            ...prev,
            wallet: {
              available: data.available,
              message: data.available ? '✓ Wallet available' : '✗ Wallet already registered — connect a different wallet or go back to login'
            }
          }));
          // ← removed the alert + navigate here
        } catch (error) {
          console.error('Error checking wallet:', error);
        }
      }
    };
    checkWallet();
  }, [connected, publicKey]);  // ← removed navigate from deps

  // Check username availability
  useEffect(() => {
    const checkUsername = async () => {
      if (role === 'operator' && formData.username && formData.username.length > 2) {
        setCheckingAvailability(true);
        try {
          const response = await fetch(`${API_BASE}/api/check/username?username=${formData.username}`);
          const data = await response.json();
          setAvailability(prev => ({
            ...prev,
            username: {
              available: data.available,
              message: data.available ? '✓ Username available' : '✗ Username already taken'
            }
          }));
        } catch (error) {
          console.error('Error checking username:', error);
        } finally {
          setCheckingAvailability(false);
        }
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.username, role]);

  // Check company name availability
  useEffect(() => {
    const checkCompanyName = async () => {
      if (role === 'enterprise' && formData.legalName && formData.legalName.length > 2) {
        setCheckingAvailability(true);
        try {
          const response = await fetch(`${API_BASE}/api/check/company?name=${encodeURIComponent(formData.legalName)}`);
          const data = await response.json();
          setAvailability(prev => ({
            ...prev,
            companyName: {
              available: data.available,
              message: data.available ? '✓ Company name available' : '✗ Company name already registered'
            }
          }));
        } catch (error) {
          console.error('Error checking company name:', error);
        } finally {
          setCheckingAvailability(false);
        }
      }
    };

    const timeoutId = setTimeout(checkCompanyName, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.legalName, role]);

  // Update autopilot options when flight stack changes
  useEffect(() => {
    if (formData.flightStack) {
      setAutopilotOptions(autopilotHardware[formData.flightStack] || []);
    } else {
      setAutopilotOptions([]);
    }
  }, [formData.flightStack]);

  // Mask wallet address
  const maskWalletAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Handle folder upload
  const handleFolderUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) {
      alert('Please select at least one certification document');
      return;
    }
    setCertificationFiles(prev => [...prev, ...files]);
  };

  // Validate certifications not empty
  const validateCertifications = () => {
    if (role === 'operator' && certificationFiles.length === 0) {
      alert('Please upload at least one certification document');
      return false;
    }
    return true;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCertificationChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      certifications: checked
        ? [...prev.certifications, value]
        : prev.certifications.filter(c => c !== value)
    }));
  };

  const handleDroneImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDroneImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setDroneImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove a file from certification list
  const removeCertificationFile = (indexToRemove) => {
    setCertificationFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Enterprise business certificate upload handler
  const handleBusinessCertUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBusinessCertFile(file);
      setBusinessCertName(file.name);
    }
  };

  const validateOperatorFields = () => {
    return formData.fullName &&
      formData.username &&
      formData.region &&
      formData.flightStack &&
      formData.autopilotHardware &&
      formData.vehicleType &&
      formData.droneModel &&
      availability.username.available === true;
  };

  const validateEnterpriseFields = () => {
    return formData.fullName &&
      formData.legalName &&
      formData.businessType &&
      formData.industry &&
      formData.operatingRegions &&
      formData.contactEmail &&
      availability.companyName.available === true;
  };

  const handleContinue = () => {
    setSubmitError('');

    if (role === 'operator') {
      if (!formData.fullName) {
        alert('Please enter your full name');
        return;
      }
      if (!formData.username) {
        alert('Please enter a username');
        return;
      }
      if (!formData.region) {
        alert('Please select your region');
        return;
      }
      if (!formData.flightStack) {
        alert('Please select flight stack');
        return;
      }
      if (!formData.autopilotHardware) {
        alert('Please select autopilot hardware');
        return;
      }
      if (!formData.vehicleType) {
        alert('Please select vehicle type');
        return;
      }
      if (!formData.droneModel) {
        alert('Please enter drone model');
        return;
      }

      // Check certifications
      if (!validateCertifications()) {
        return;
      }

      // Check username availability
      if (availability.username.available === false) {
        alert('Username is already taken. Please choose another one.');
        return;
      }

      if (availability.username.available === null && formData.username.length > 2) {
        alert('Please wait for username availability check to complete.');
        return;
      }

      setStep(3);

    } else {
      // Enterprise validation
      if (!formData.fullName) {
        alert('Please enter your full name');
        return;
      }
      if (!formData.legalName) {
        alert('Please enter company name');
        return;
      }
      if (!formData.businessType) {
        alert('Please select business type');
        return;
      }
      if (!formData.industry) {
        alert('Please select industry');
        return;
      }
      if (!formData.operatingRegions) {
        alert('Please select operating region');
        return;
      }
      if (!formData.contactEmail) {
        alert('Please enter contact email');
        return;
      }

      // Check company name availability
      if (availability.companyName.available === false) {
        alert('Company name is already registered. Please choose another one.');
        return;
      }

      if (availability.companyName.available === null && formData.legalName.length > 2) {
        alert('Please wait for company name availability check to complete.');
        return;
      }

      setStep(3);
    }
  };

  const openWalletModal = () => {
    setVisible(true);
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  // Returns { signature, nonce } from a server-issued challenge, or null on failure.
  // Replay-resistant: nonce is single-use and 5-minute time-bound (server-side).
  const verifyWalletOwnership = async () => {
    if (!connected || !publicKey || !signMessage) {
      setVerificationError('Wallet not connected or does not support message signing');
      return null;
    }

    if (availability.wallet.available === false) {
      setVerificationError('This wallet is already registered');
      return null;
    }

    try {
      setIsVerifying(true);
      setVerificationError('');
      // Server picks the nonce + statement; we sign and return base58 signature.
      const proof = await getSignupProof(publicKey.toBase58(), signMessage);
      return proof; // { signature, nonce }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationError(error.message || 'Failed to verify wallet');
      return null;
    } finally {
      setIsVerifying(false);
    }
  };

  const uploadFileToServer = async (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  // Posts the operator profile + the signed challenge proof together.
  // On success returns { user, token } from the server.
  const submitOperatorToDatabase = async (walletAddress, proof) => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      let droneImageUrl = '';
      if (droneImage) droneImageUrl = await uploadFileToServer(droneImage, 'drone');

      const certFiles = [];
      for (const file of certificationFiles) {
        const url = await uploadFileToServer(file, 'certification');
        if (url) certFiles.push({ name: file.name, url, type: file.type });
      }

      const response = await fetch(`${API_BASE}/api/operators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          signature: proof.signature,
          nonce: proof.nonce,
          full_name: formData.fullName,
          username: formData.username,
          region: formData.region,
          drone_model: formData.droneModel,
          drone_image: droneImageUrl,
          flight_stack: formData.flightStack,
          autopilot_hardware: formData.autopilotHardware,
          vehicle_type: formData.vehicleType,
          firmware_version: formData.firmwareVersion,
          communication_protocol: formData.communicationProtocol,
          experience: formData.experience,
          certifications: formData.certifications,
          certification_files: certFiles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create operator account');
      }

      const data = await response.json();
      return {
        user: {
          id: data.id,
          fullName: formData.fullName,
          username: formData.username,
          walletAddress,
          role: 'operator',
        },
        token: data.token,
      };
    } catch (error) {
      console.error('Database error:', error);
      setSubmitError(error.message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Posts the enterprise profile + the signed challenge proof together.
  const submitEnterpriseToDatabase = async (walletAddress, proof) => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      let businessCertUrl = null;
      if (businessCertFile) businessCertUrl = await uploadFileToServer(businessCertFile, 'business_cert');

      const response = await fetch(`${API_BASE}/api/enterprises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          signature: proof.signature,
          nonce: proof.nonce,
          company_name: formData.legalName,
          business_type: formData.businessType,
          year_established: formData.yearEstablished ? parseInt(formData.yearEstablished) : null,
          industry: formData.industry,
          operating_regions: formData.operatingRegions,
          contact_name: formData.fullName,
          contact_email: formData.contactEmail,
          contact_phone: formData.contactPhone || null,
          website: formData.website || null,
          description: formData.companyDescription || null,
          business_certificate_url: businessCertUrl,
          business_verified: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create enterprise account');
      }

      const data = await response.json();
      return {
        user: {
          id: data.id,
          fullName: formData.fullName,
          companyName: formData.legalName,
          walletAddress,
          role: 'enterprise',
        },
        token: data.token,
      };
    } catch (error) {
      console.error('Database error:', error);
      setSubmitError(error.message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Sign the wallet challenge (proves wallet ownership).
  // 2. POST profile + proof — server verifies, creates record, issues JWT.
  // 3. Persist user + token via session context, then route to dashboard.
  const completeSignup = async () => {
    const proof = await verifyWalletOwnership();
    if (!proof) return;

    const submitter = role === 'operator' ? submitOperatorToDatabase : submitEnterpriseToDatabase;
    const result = await submitter(publicKey.toBase58(), proof);
    if (!result) return;

    login(result.user, result.token);
    navigate(role === 'operator' ? '/operator/dashboard' : '/enterprise/dashboard');
  };

  // Complete styles
  const styles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background-color: #0a0a0a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    }

    .signup-page {
      width: 100%;
      min-height: 100vh;
      background-color: #0a0a0a;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .signup-container {
      background: white;
      padding: 40px;
      border-radius: 30px;
      box-shadow: 0 20px 40px rgba(147, 51, 234, 0.2);
      width: 100%;
      max-width: 700px;
      position: relative;
      z-index: 10;
      max-height: 90vh;
      overflow-y: auto;
      color: #333;
    }

    /* Curved background elements */
    .curved-line-1, .curved-line-2, .curved-line-3 {
      position: fixed;
      z-index: 1;
      pointer-events: none;
    }
    
    .curved-line-1 {
      top: 10%;
      right: -10%;
      width: 600px;
      height: 600px;
      border-radius: 62% 38% 42% 58% / 41% 55% 45% 59%;
      background: linear-gradient(135deg, #c084fc40, #f9a8d440);
      opacity: 0.5;
      filter: blur(60px);
      transform: rotate(15deg);
    }
    
    .curved-line-2 {
      bottom: -20%;
      left: -5%;
      width: 700px;
      height: 700px;
      border-radius: 73% 27% 58% 42% / 33% 64% 36% 67%;
      background: linear-gradient(225deg, #a855f740, #ec489940);
      opacity: 0.5;
      filter: blur(70px);
      transform: rotate(-10deg);
    }
    
    .curved-line-3 {
      top: 40%;
      left: 20%;
      width: 400px;
      height: 400px;
      border-radius: 51% 49% 33% 67% / 56% 59% 41% 44%;
      background: linear-gradient(45deg, #d8b4fe40, #fbcfe840);
      opacity: 0.4;
      filter: blur(80px);
    }
    
    .progress-steps {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 30px;
    }
    
    .step-indicator {
      width: 60px;
      height: 4px;
      background: #eee;
      border-radius: 2px;
      transition: background 0.3s ease;
    }
    
    .step-indicator.active {
      background: #9333ea;
    }
    
    .role-selector {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .role-card {
      flex: 1;
      padding: 30px;
      border: 2px solid #eee;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
    }
    
    .role-card:hover {
      border-color: #9333ea;
      transform: translateY(-2px);
    }
    
    .role-card.selected {
      border-color: #9333ea;
      background: #f3f0ff;
    }
    
    .role-card .icon {
      font-size: 40px;
      margin-bottom: 15px;
    }
    
    .role-card h3 {
      color: #333;
      margin-bottom: 10px;
    }
    
    .role-card p {
      color: #666;
      font-size: 14px;
    }
    
    .form-section {
      margin-bottom: 30px;
      padding: 20px;
      background: #f8f8f8;
      border-radius: 16px;
    }
    
    .form-section h3 {
      color: #333;
      font-size: 18px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      color: #333;
      font-weight: 500;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #ddd;
      border-radius: 10px;
      font-size: 16px;
      transition: all 0.3s ease;
      background: white;
      color: #333;
    }
    
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #9333ea;
      box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1);
      color: #333;
    }
    
    .form-group input::placeholder,
    .form-group select::placeholder,
    .form-group textarea::placeholder {
      color: #999;
    }
    
    select option {
      color: #333;
    }
    
    .certification-group {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .certification-item {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #333;
    }
    
    .certification-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    
    .image-upload {
      border: 2px dashed #ddd;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: #fafafa;
    }
    
    .image-upload:hover {
      border-color: #9333ea;
      background: #f3f0ff;
    }
    
    .image-preview {
      max-width: 100%;
      max-height: 200px;
      margin-top: 15px;
      border-radius: 10px;
      border: 1px solid #ddd;
    }
    
    .file-upload {
      border: 2px dashed #ddd;
      padding: 30px;
      border-radius: 10px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .file-upload:hover {
      border-color: #9333ea;
      background: #f3f0ff;
    }
    
    .file-upload input {
      display: none;
    }
    
    .file-list {
      margin-top: 15px;
    }
    
    .file-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      background: #f8f8f8;
      border-radius: 5px;
      margin-bottom: 5px;
      font-size: 14px;
      color: #333;
    }
    
    .wallet-card {
      background: #f8f8f8;
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .wallet-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    
    .wallet-connected {
      background: #f0fdf4;
      border: 1px solid #22c55e;
      padding: 20px;
      border-radius: 20px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .wallet-address {
      background: white;
      padding: 12px;
      border-radius: 10px;
      font-family: monospace;
      font-size: 14px;
      color: #333;
      margin: 15px 0;
      border: 1px solid #e0e0e0;
      word-break: break-all;
    }
    
    .error-message {
      background: #fee2e2;
      border: 1px solid #ef4444;
      color: #b91c1c;
      padding: 12px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    
    .primary-btn {
      background: #9333ea;
      border: none;
      color: white;
      padding: 14px 32px;
      border-radius: 40px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      width: 100%;
    }
    
    .primary-btn:hover:not(:disabled) {
      background: #a855f7;
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(147, 51, 234, 0.3);
    }
    
    .primary-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .secondary-btn {
      background: transparent;
      border: 1px solid #9333ea;
      color: #9333ea;
      padding: 12px 30px;
      border-radius: 40px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      width: 100%;
    }
    
    .secondary-btn:hover:not(:disabled) {
      background: #f3f0ff;
    }
    
    .back-btn {
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      font-size: 14px;
      margin-top: 20px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    
    .back-btn:hover {
      color: #9333ea;
    }
    
    .helper-text {
      color: #999;
      font-size: 12px;
      margin-top: 5px;
    }
    
    .username-hint {
      color: #22c55e;
      font-size: 12px;
      margin-top: 5px;
    }

    .disconnect-link {
      color: #ef4444;
      font-size: 12px;
      text-decoration: none;
      margin-top: 10px;
      display: inline-block;
      cursor: pointer;
    }

    .disconnect-link:hover {
      text-decoration: underline;
    }

    .availability-check {
      font-size: 12px;
      margin-top: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .available {
      color: #22c55e;
    }
    
    .unavailable {
      color: #ef4444;
    }

    @media (max-width: 768px) {
      .form-row {
        grid-template-columns: 1fr;
      }
      
      .certification-group {
        grid-template-columns: 1fr;
      }
      
      .role-selector {
        flex-direction: column;
      }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="signup-page">
        <div className="curved-line-1"></div>
        <div className="curved-line-2"></div>
        <div className="curved-line-3"></div>

        <div className="signup-container">
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <img
              src={logo}
              alt="Sol Skies"
              style={{
                width: '100px',
                marginBottom: '20px',
                display: 'inline-block'
              }}
            />
            <h1 style={{ color: '#333', fontSize: '28px', marginBottom: '5px' }}>
              Create Account
            </h1>
            <p style={{ color: '#666', fontSize: '14px' }}>
              {step === 1 ? 'Choose your account type' :
                step === 2 ? (role === 'operator' ? 'Enter operator details' : 'Enter company details') :
                  'Connect and verify your wallet'}
            </p>
          </div>

          {/* Progress Indicators */}
          <div className="progress-steps">
            <div className={`step-indicator ${step >= 1 ? 'active' : ''}`}></div>
            <div className={`step-indicator ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`step-indicator ${step >= 3 ? 'active' : ''}`}></div>
          </div>

          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div>
              <div className="role-selector">
                <div
                  className={`role-card ${role === 'operator' ? 'selected' : ''}`}
                  onClick={() => setRole('operator')}
                >
                  <div className="icon">🚁</div>
                  <h3>Drone Operator</h3>
                  <p>I fly drones and want to accept missions</p>
                </div>

                <div
                  className={`role-card ${role === 'enterprise' ? 'selected' : ''}`}
                  onClick={() => setRole('enterprise')}
                >
                  <div className="icon">🏢</div>
                  <h3>Enterprise</h3>
                  <p>I need drone services for my business</p>
                </div>
              </div>

              <button
                className="primary-btn"
                onClick={() => setStep(2)}
                disabled={!role}
                style={{ opacity: role ? 1 : 0.5 }}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Details based on role */}
          {step === 2 && (
            <div>
              {role === 'operator' ? (
                // Operator Fields
                <div>
                  <div className="form-section">
                    <h3>Personal Information</h3>
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="e.g. John Smith"
                      />
                    </div>

                    <div className="form-group">
                      <label>Username *</label>
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        placeholder="e.g. johnsmith"
                      />
                      {availability.username.message && (
                        <div className={`availability-check ${availability.username.available ? 'available' : 'unavailable'}`}>
                          {availability.username.message}
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Operating Region *</label>
                      <select
                        name="region"
                        value={formData.region}
                        onChange={handleInputChange}
                      >
                        <option value="">Select your country</option>
                        {countries.map(country => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3>Drone Information</h3>

                    <div className="form-group">
                      <label>Drone Model *</label>
                      <input
                        type="text"
                        name="droneModel"
                        value={formData.droneModel}
                        onChange={handleInputChange}
                        placeholder="e.g. DJI Mavic 3 Enterprise"
                      />
                    </div>

                    <div className="form-group">
                      <label>Drone Image</label>
                      <div className="image-upload" onClick={() => document.getElementById('drone-image').click()}>
                        <input
                          id="drone-image"
                          type="file"
                          accept="image/*"
                          onChange={handleDroneImageUpload}
                          style={{ display: 'none' }}
                        />
                        <div style={{ fontSize: '24px', marginBottom: '10px' }}>📸</div>
                        <div>Click to upload drone photo</div>
                      </div>
                      {droneImagePreview && (
                        <img src={droneImagePreview} alt="Drone preview" className="image-preview" />
                      )}
                    </div>

                    <div className="form-group">
                      <label>Flight Stack *</label>
                      <select
                        name="flightStack"
                        value={formData.flightStack}
                        onChange={handleInputChange}
                      >
                        <option value="">Select flight stack</option>
                        {flightStacks.map(stack => (
                          <option key={stack.value} value={stack.value}>
                            {stack.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Autopilot Hardware *</label>
                      <select
                        name="autopilotHardware"
                        value={formData.autopilotHardware}
                        onChange={handleInputChange}
                        disabled={!formData.flightStack}
                      >
                        <option value="">Select autopilot hardware</option>
                        {autopilotOptions.map(hw => (
                          <option key={hw.value} value={hw.value}>
                            {hw.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Vehicle Type *</label>
                        <select
                          name="vehicleType"
                          value={formData.vehicleType}
                          onChange={handleInputChange}
                        >
                          <option value="">Select type</option>
                          {vehicleTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Experience Level *</label>
                        <select
                          name="experience"
                          value={formData.experience}
                          onChange={handleInputChange}
                        >
                          <option value="">Select experience</option>
                          {experienceLevels.map(level => (
                            <option key={level.value} value={level.value}>
                              {level.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Firmware Version</label>
                      <input
                        type="text"
                        name="firmwareVersion"
                        value={formData.firmwareVersion}
                        onChange={handleInputChange}
                        placeholder="e.g. 4.5.1"
                      />
                      <div className="helper-text">Will be auto-detected on first connection</div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3>Certifications & Licenses</h3>

                    <div className="certification-group">
                      {certificationBodies.map(cert => (
                        <label key={cert.value} className="certification-item">
                          <input
                            type="checkbox"
                            value={cert.value}
                            checked={formData.certifications.includes(cert.value)}
                            onChange={handleCertificationChange}
                          />
                          {cert.label}
                        </label>
                      ))}
                    </div>

                    {/* Updated certification upload with folder support */}
                    <div className="form-group">
                      <label>Upload Certification Documents *</label>
                      <div
                        className="file-upload"
                        onClick={() => document.getElementById('cert-upload').click()}
                        style={{
                          border: certificationFiles.length === 0 ? '2px dashed #ef4444' : '2px dashed #ddd'
                        }}
                      >
                        <input
                          id="cert-upload"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFolderUpload}
                          style={{ display: 'none' }}
                          {...({ webkitdirectory: true, directory: true })}
                        />
                        <div style={{ fontSize: '24px', marginBottom: '10px' }}>📁</div>
                        <div>Click to select certification documents</div>
                        <div className="helper-text">
                          {certificationFiles.length === 0
                            ? '⚠️ At least one certification document is required'
                            : `${certificationFiles.length} file(s) selected`}
                        </div>
                      </div>

                      {certificationFiles.length > 0 && (
                        <div className="file-list">
                          {certificationFiles.map((file, index) => (
                            <div key={index} className="file-item">
                              <span>📄</span>
                              <span>{file.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCertificationFile(index);
                                }}
                                style={{
                                  marginLeft: 'auto',
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '16px'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Enterprise Fields
                <div>
                  <div className="form-section">
                    <h3>Contact Person</h3>
                    <div className="form-group">
                      <label>Your Full Name *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        placeholder="e.g. John Smith"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Email *</label>
                        <input
                          type="email"
                          name="contactEmail"
                          value={formData.contactEmail}
                          onChange={handleInputChange}
                          placeholder="john@company.com"
                        />
                      </div>
                      <div className="form-group">
                        <label>Phone</label>
                        <input
                          type="tel"
                          name="contactPhone"
                          value={formData.contactPhone}
                          onChange={handleInputChange}
                          placeholder="+1 234 567 8900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3>Company Information</h3>

                    <div className="form-group">
                      <label>Legal Company Name *</label>
                      <input
                        type="text"
                        name="legalName"
                        value={formData.legalName}
                        onChange={handleInputChange}
                        placeholder="e.g. SkyBuild Construction LLC"
                      />
                      {availability.companyName.message && (
                        <div className={`availability-check ${availability.companyName.available ? 'available' : 'unavailable'}`}>
                          {availability.companyName.message}
                        </div>
                      )}
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Business Type *</label>
                        <select
                          name="businessType"
                          value={formData.businessType}
                          onChange={handleInputChange}
                        >
                          <option value="">Select type</option>
                          {businessTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Year Established</label>
                        <input
                          type="text"
                          name="yearEstablished"
                          value={formData.yearEstablished}
                          onChange={handleInputChange}
                          placeholder="e.g. 2015"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Industry / Sector *</label>
                      <select
                        name="industry"
                        value={formData.industry}
                        onChange={handleInputChange}
                      >
                        <option value="">Select industry</option>
                        {industries.map(ind => (
                          <option key={ind.value} value={ind.value}>
                            {ind.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Operating Regions *</label>
                      <select
                        name="operatingRegions"
                        value={formData.operatingRegions}
                        onChange={handleInputChange}
                      >
                        <option value="">Select primary region</option>
                        {countries.map(country => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                      <div className="helper-text">You can add more regions later</div>
                    </div>

                    <div className="form-group">
                      <label>Website</label>
                      <input
                        type="url"
                        name="website"
                        value={formData.website}
                        onChange={handleInputChange}
                        placeholder="https://www.company.com"
                      />
                    </div>

                    <div className="form-group">
                      <label>Company Description</label>
                      <textarea
                        name="companyDescription"
                        value={formData.companyDescription}
                        onChange={handleInputChange}
                        placeholder="Tell operators about your company and typical missions..."
                        rows="3"
                      />
                    </div>
                  </div>

                  {/* Business Certification Section */}
                  <div className="form-section" style={{ background: '#0f0f1a', border: '1px solid #9333ea33' }}>
                    <h3 style={{ color: '#c084fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                      🏛️ Business Certification
                      <span style={{ fontSize: 12, fontWeight: 400, color: '#666', marginLeft: 4 }}>Optional — upload to get a verified badge</span>
                    </h3>
                    <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
                      Upload your business registration certificate, tax ID, or incorporation document. Verified enterprises earn a ✅ badge and gain operator trust.
                    </p>
                    <div className="form-group">
                      <label>Business Certificate</label>
                      <div
                        className="file-upload"
                        onClick={() => document.getElementById('biz-cert-upload').click()}
                        style={{
                          border: businessCertFile ? '2px dashed #9333ea' : '2px dashed #333',
                          background: businessCertFile ? '#9333ea0a' : '#0a0a0a',
                          cursor: 'pointer', borderRadius: 12, padding: '20px',
                          textAlign: 'center', transition: 'all .2s'
                        }}
                      >
                        <input
                          id="biz-cert-upload"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleBusinessCertUpload}
                          style={{ display: 'none' }}
                        />
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{businessCertFile ? '✅' : '🏛️'}</div>
                        {businessCertFile ? (
                          <div style={{ color: '#22c55e', fontWeight: 600 }}>
                            {businessCertName}
                            <div style={{ color: '#888', fontSize: 12, fontWeight: 400, marginTop: 4 }}>
                              Click to replace
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ color: '#ccc' }}>Click to upload business certificate</div>
                            <div className="helper-text">PDF, JPG or PNG — business reg, tax ID, or incorporation doc</div>
                          </>
                        )}
                      </div>
                      {businessCertFile && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setBusinessCertFile(null); setBusinessCertName(''); }}
                          style={{ marginTop: 8, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}
                        >
                          ✕ Remove certificate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="error-message">
                  {submitError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', marginTop: '30px' }}>
                <button
                  className="secondary-btn"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button
                  className="primary-btn"
                  onClick={handleContinue}
                >
                  Continue to Wallet
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Connect Wallet */}
          {step === 3 && (
            <div>
              {!connected ? (
                <div className="wallet-card">
                  <div className="wallet-icon">🔌</div>
                  <h3 style={{ color: '#333', marginBottom: '10px' }}>
                    Connect Your Wallet
                  </h3>
                  <p style={{ color: '#666', marginBottom: '30px', fontSize: '14px' }}>
                    Connect with Phantom, Solflare, or any Solana wallet to verify your identity
                  </p>

                  <button
                    className="primary-btn"
                    onClick={openWalletModal}
                  >
                    Select Wallet
                  </button>

                  <div style={{ marginTop: '20px' }}>
                    <a
                      href="#"
                      style={{ color: '#9333ea', textDecoration: 'none', fontSize: '14px' }}
                      onClick={(e) => {
                        e.preventDefault();
                        window.open('https://solana.com/wallets', '_blank');
                      }}
                    >
                      What is a Solana wallet?
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="wallet-connected">
                    <div style={{ fontSize: '40px', marginBottom: '15px' }}>✅</div>
                    <h3 style={{ color: '#333', marginBottom: '10px' }}>
                      Wallet Connected!
                    </h3>
                    {/* Masked wallet address */}
                    <div className="wallet-address">
                      {maskWalletAddress(publicKey?.toBase58())}
                    </div>
                    {availability.wallet.message && (
                      <div className={`availability-check ${availability.wallet.available ? 'available' : 'unavailable'}`}>
                        {availability.wallet.message}
                      </div>
                    )}
                  </div>

                  {verificationError && (
                    <div className="error-message">
                      {verificationError}
                    </div>
                  )}

                  <div style={{ marginTop: '20px' }}>
                    <p style={{
                      background: '#f8f8f8',
                      padding: '15px',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#555',
                      marginBottom: '20px'
                    }}>
                      <strong>Account Summary:</strong><br />
                      {role === 'operator' ? (
                        <>
                          {formData.fullName} (@{formData.username})<br />
                          {formData.droneModel} • {formData.region}<br />
                          {formData.experience} experience<br />
                          {certificationFiles.length} certification(s) uploaded
                        </>
                      ) : (
                        <>
                          {formData.legalName}<br />
                          {formData.industry} • {formData.operatingRegions}<br />
                          Contact: {formData.contactEmail}<br />
                          {businessCertFile ? `🏛️ Certificate: ${businessCertName}` : '⚠️ No business certificate (optional)'}
                        </>
                      )}
                    </p>
                  </div>

                  <button
                    className="primary-btn"
                    onClick={completeSignup}
                    disabled={isVerifying || isSubmitting || availability.wallet.available === false}
                  >
                    {isVerifying ? 'Verifying...' :
                      isSubmitting ? 'Creating Account...' :
                        `Create ${role === 'operator' ? 'Operator' : 'Enterprise'} Account`}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '15px' }}>
                    <button
                      className="disconnect-link"
                      onClick={disconnectWallet}
                    >
                      Use a different wallet
                    </button>
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button
                  className="back-btn"
                  onClick={() => setStep(2)}
                  disabled={isVerifying}
                >
                  ← Back to details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default SignUp;