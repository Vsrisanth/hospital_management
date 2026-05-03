const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// In-memory transaction log
let transactions = [];

// Payment validation rules by method
const paymentValidators = {
  card: (data) => {
    if (!data.cardNumber || data.cardNumber.length < 13) throw new Error('Invalid card number');
    if (!data.cardName) throw new Error('Cardholder name required');
    if (!data.cardExpiry) throw new Error('Card expiry required');
    if (!data.cardCvv || data.cardCvv.length < 3) throw new Error('Invalid CVV');
    return true;
  },
  upi: (data) => {
    if (!data.upiId || !data.upiId.includes('@')) throw new Error('Invalid UPI ID');
    return true;
  },
  netbanking: (data) => {
    if (!data.bankName) throw new Error('Bank selection required');
    if (!data.accountNumber) throw new Error('Account number required');
    return true;
  },
  wallet: (data) => {
    if (!data.walletPhone) throw new Error('Phone number required');
    if (data.walletBalance < data.amount) throw new Error('Insufficient wallet balance');
    return true;
  },
  insurance: (data) => {
    if (!data.policyNumber) throw new Error('Policy number required');
    if (!data.insuranceCompany) throw new Error('Insurance company required');
    return true;
  }
};

// Simulate payment gateway processing
function processPaymentGateway(method, data) {
  const delay = Math.random() * 1000 + 500;
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate occasional network delays or processing times
      const successRate = 0.95;
      const success = Math.random() < successRate;
      resolve(success);
    }, delay);
  });
}

// POST /api/process-payment
app.post('/api/process-payment', async (req, res) => {
  try {
    const { billId, amount, method, patientId, patientName, billDescription, details } = req.body;

    // Validate input
    if (!billId || !amount || !method) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Validate payment method details
    if (paymentValidators[method]) {
      paymentValidators[method](details);
    }

    // Process through payment gateway
    const gatewaySuccess = await processPaymentGateway(method, details);
    
    if (!gatewaySuccess) {
      throw new Error('Payment gateway processing failed. Please try again.');
    }

    // Create transaction record
    const transaction = {
      id: `TXN-${Date.now()}`,
      billId,
      patientId,
      patientName,
      amount,
      method,
      status: 'completed',
      timestamp: new Date().toISOString(),
      reference: `REF-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      details: {
        method,
        lastDigits: method === 'card' ? details.cardNumber.slice(-4) : 
                   method === 'upi' ? details.upiId :
                   method === 'netbanking' ? details.bankName :
                   method === 'wallet' ? details.walletPhone :
                   method === 'insurance' ? details.policyNumber : 'N/A'
      }
    };

    transactions.push(transaction);

    res.json({
      success: true,
      transaction,
      message: `Payment of ₹${amount} processed successfully via ${method}`
    });

  } catch (error) {
    console.error('Payment processing error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Payment processing failed'
    });
  }
});

// GET /api/transactions
app.get('/api/transactions', (req, res) => {
  const { billId, limit = 50 } = req.query;
  let filtered = transactions;
  
  if (billId) {
    filtered = filtered.filter(t => t.billId === billId);
  }
  
  res.json({
    success: true,
    transactions: filtered.slice(-limit),
    total: filtered.length
  });
});

// GET /api/transaction/:id
app.get('/api/transaction/:id', (req, res) => {
  const transaction = transactions.find(t => t.id === req.params.id);
  if (!transaction) {
    return res.status(404).json({ success: false, error: 'Transaction not found' });
  }
  res.json({ success: true, transaction });
});

// POST /api/validate-payment
app.post('/api/validate-payment', (req, res) => {
  try {
    const { method, details } = req.body;
    
    if (!method || !paymentValidators[method]) {
      return res.status(400).json({ success: false, error: 'Invalid payment method' });
    }

    paymentValidators[method](details);
    
    res.json({
      success: true,
      message: 'Payment details validated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/payment-methods
app.get('/api/payment-methods', (req, res) => {
  const methods = [
    { id: 'card', label: 'Credit/Debit Card', icon: 'fa-credit-card', active: true, fields: ['cardNumber', 'cardName', 'cardExpiry', 'cardCvv'] },
    { id: 'upi', label: 'UPI', icon: 'fa-mobile-alt', active: true, fields: ['upiId'] },
    { id: 'netbanking', label: 'Net Banking', icon: 'fa-university', active: true, fields: ['bankName', 'accountNumber'] },
    { id: 'wallet', label: 'Wallet', icon: 'fa-wallet', active: true, fields: ['walletPhone', 'walletBalance'] },
    { id: 'insurance', label: 'Insurance', icon: 'fa-shield-alt', active: true, fields: ['policyNumber', 'insuranceCompany'] }
  ];
  res.json({ success: true, methods });
});

// GET /api/payment-status/:billId
app.get('/api/payment-status/:billId', (req, res) => {
  const transaction = transactions.find(t => t.billId === req.params.billId);
  if (transaction) {
    res.json({ success: true, paid: true, transaction });
  } else {
    res.json({ success: true, paid: false });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Payment server is running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🏥 SMART Dr. Payment Server running on http://localhost:${PORT}`);
  console.log(`📊 Payment API ready at http://localhost:${PORT}/api`);
});
