import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Quote, QuoteItem, QuoteStatus, DeviceType, Customer } from '../types';
import { X, Save, Plus, Trash2, Camera, User, Wrench, Package, Search, Sparkles, Loader2, Eye, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from '../lib/imageUtils';

interface QuoteFormProps {
  onClose: () => void;
  initialQuote?: Quote | null;
  onSaved?: (quoteId: string) => void;
}

const COMMON_SERVICES = [
  { name: 'Limpeza de notebook com troca de pasta térmica', price: 120 },
  { name: 'Limpeza preventiva desktop + gerenciamento de cabos', price: 100 },
  { name: 'Formatação, instalação de SO e otimização', price: 90 },
  { name: 'Formatação com backup completo de arquivos', price: 130 },
  { name: 'Troca de tela de notebook', price: 100 },
  { name: 'Troca de teclado / touchpad', price: 80 },
  { name: 'Reparo eletrônico de placa-mãe / Curto circuito', price: 250 },
  { name: 'Instalação e upgrade de componentes', price: 60 },
  { name: 'Substituição de carcaça e dobradiças', price: 120 },
  { name: 'Recuperação de dados e arquivos', price: 180 }
];

const COMMON_PARTS = [
  { name: 'Placa mãe Gigabyte B450M DS3H', price: 480 },
  { name: 'SSD NVMe 512GB Kingston NV2', price: 240 },
  { name: 'SSD NVMe 1TB Kingston NV2', price: 390 },
  { name: 'SSD SATA 240GB Crucial / Kingston', price: 150 },
  { name: 'Memória RAM 8GB DDR4 3200MHz', price: 130 },
  { name: 'Memória RAM 16GB DDR4 3200MHz', price: 220 },
  { name: 'Fonte ATX 500W 80 Plus Bronze', price: 260 },
  { name: 'Pasta Térmica Alta Condutividade (Aplicação)', price: 40 },
  { name: 'Cooler para Processador', price: 90 },
  { name: 'Bateria para Notebook (Original / Similar)', price: 210 }
];

export default function QuoteForm({ onClose, initialQuote, onSaved }: QuoteFormProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialQuote?.customerId || null);

  const [customerName, setCustomerName] = useState(initialQuote?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initialQuote?.customerPhone || '');
  const [customerEmail, setCustomerEmail] = useState(initialQuote?.customerEmail || '');
  const [customerAddress, setCustomerAddress] = useState(initialQuote?.customerAddress || '');

  const [deviceType, setDeviceType] = useState<DeviceType>(initialQuote?.deviceType || DeviceType.Notebook);
  const [deviceBrand, setDeviceBrand] = useState(initialQuote?.deviceBrand || '');
  const [deviceModel, setDeviceModel] = useState(initialQuote?.deviceModel || '');
  const [serialNumber, setSerialNumber] = useState(initialQuote?.serialNumber || '');

  const [reportedProblem, setReportedProblem] = useState(initialQuote?.reportedProblem || '');
  const [technicalDiagnosis, setTechnicalDiagnosis] = useState(initialQuote?.technicalDiagnosis || '');

  const [items, setItems] = useState<QuoteItem[]>(
    initialQuote?.items && initialQuote.items.length > 0
      ? initialQuote.items
      : [
          {
            id: 'item-1',
            type: 'service',
            description: 'Limpeza de notebook com troca de pasta térmica',
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120
          }
        ]
  );

  const [discount, setDiscount] = useState<number>(initialQuote?.discount || 0);
  const [validityDays, setValidityDays] = useState<number>(initialQuote?.validityDays || 10);
  const [notes, setNotes] = useState(initialQuote?.notes || '');
  const [status, setStatus] = useState<QuoteStatus>(initialQuote?.status || QuoteStatus.Pending);

  const [devicePhotos, setDevicePhotos] = useState<string[]>(initialQuote?.devicePhotos || []);
  const [compressing, setCompressing] = useState(false);
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);

  // Load existing customers for autocomplete
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const q = query(collection(db, 'customers'), orderBy('name', 'asc'), limit(50));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
        setCustomers(list);
      } catch (err) {
        console.error("Erro ao carregar clientes", err);
      }
    };
    fetchCustomers();
  }, []);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id || null);
    setCustomerName(c.name);
    setCustomerPhone(c.phone || c.whatsapp || '');
    setCustomerEmail(c.email || '');
    if (c.street) {
      setCustomerAddress(`${c.street}, ${c.number || 'S/N'} - ${c.neighborhood || ''}`);
    }
    setShowCustomerResults(false);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerName.toLowerCase()) ||
    c.phone.includes(customerName)
  );

  // Items manipulation
  const addItem = (type: 'service' | 'product' = 'service', description = '', unitPrice = 0) => {
    const newItem: QuoteItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type,
      description,
      quantity: 1,
      unitPrice: unitPrice,
      totalPrice: unitPrice
    };
    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const q = field === 'quantity' ? Number(value) : Number(item.quantity);
        const p = field === 'unitPrice' ? Number(value) : Number(item.unitPrice);
        updated.totalPrice = Number((q * p).toFixed(2));
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) {
      setItems([{
        id: 'item-1',
        type: 'service',
        description: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0
      }]);
      return;
    }
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Totals calculations
  const servicesCost = items
    .filter(i => i.type === 'service')
    .reduce((sum, i) => sum + Number(i.totalPrice || (i.quantity * i.unitPrice) || 0), 0);

  const partsCost = items
    .filter(i => i.type !== 'service')
    .reduce((sum, i) => sum + Number(i.totalPrice || (i.quantity * i.unitPrice) || 0), 0);

  const subtotal = servicesCost + partsCost;
  const totalAmount = Math.max(0, subtotal - Number(discount || 0));

  // Photo handlers
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCompressing(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const compressed = await compressImage(file);
          newPhotos.push(compressed);
        }
      }
      setDevicePhotos(prev => [...prev, ...newPhotos]);
    } catch (err) {
      console.error("Erro ao comprimir fotos", err);
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setDevicePhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      let customerId = selectedCustomerId;

      // Auto create customer if not found
      if (!customerId && customerName.trim() && customerPhone.trim()) {
        try {
          const newCustRef = await addDoc(collection(db, 'customers'), {
            name: customerName.trim(),
            phone: customerPhone.trim(),
            whatsapp: customerPhone.trim(),
            email: customerEmail.trim() || null,
            address: customerAddress.trim() || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: auth.currentUser.uid
          });
          customerId = newCustRef.id;
        } catch (err) {
          console.warn("Não foi possível auto-salvar o cliente:", err);
        }
      }

      // Generate sequential quote number if new
      let quoteNumber = initialQuote?.quoteNumber;
      if (!quoteNumber) {
        const currentYear = new Date().getFullYear();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        quoteNumber = `ORC-${currentYear}-${randomNum}`;
      }

      // Clean items
      const cleanItems = items.map(item => ({
        id: item.id,
        type: item.type,
        description: item.description.trim() || (item.type === 'service' ? 'Serviço Técnico' : 'Produto/Peça'),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        totalPrice: Number(item.totalPrice) || (Number(item.quantity || 1) * Number(item.unitPrice || 0))
      }));

      const quoteData = {
        quoteNumber,
        customerId: customerId || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        customerAddress: customerAddress.trim() || null,
        deviceType,
        deviceBrand: deviceBrand.trim(),
        deviceModel: deviceModel.trim(),
        serialNumber: serialNumber.trim() || null,
        reportedProblem: reportedProblem.trim(),
        technicalDiagnosis: technicalDiagnosis.trim() || null,
        items: cleanItems,
        servicesCost: Number(servicesCost.toFixed(2)),
        partsCost: Number(partsCost.toFixed(2)),
        discount: Number(Number(discount || 0).toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        validityDays: Number(validityDays) || 10,
        notes: notes.trim() || null,
        devicePhotos,
        status,
        updatedAt: serverTimestamp()
      };

      if (initialQuote?.id) {
        await updateDoc(doc(db, 'quotes', initialQuote.id), quoteData);
        if (onSaved) onSaved(initialQuote.id);
      } else {
        const newDocRef = await addDoc(collection(db, 'quotes'), {
          ...quoteData,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser.uid
        });
        if (onSaved) onSaved(newDocRef.id);
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, initialQuote?.id ? OperationType.UPDATE : OperationType.CREATE, 'quotes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 tracking-tight text-xl">
                {initialQuote ? `Editar Orçamento #${initialQuote.quoteNumber}` : 'Novo Orçamento de Serviços & Peças'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Elabore a proposta comercial detalhada para o cliente com cálculo automático
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* Section 1: Customer Information */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <User size={16} className="text-blue-600" /> Dados do Cliente
              </h4>
              {selectedCustomerId && (
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} /> Cliente Vinculado
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Nome do Cliente *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Digite o nome ou busque..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setShowCustomerResults(true);
                      setSelectedCustomerId(null);
                    }}
                    onFocus={() => setShowCustomerResults(true)}
                  />
                  <Search size={16} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
                </div>

                {/* Autocomplete dropdown */}
                {showCustomerResults && customerName && filteredCustomers.length > 0 && !selectedCustomerId && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredCustomers.map(cust => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => handleSelectCustomer(cust)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50/80 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{cust.name}</p>
                          <p className="text-slate-400 text-[11px]">{cust.phone || cust.whatsapp}</p>
                        </div>
                        <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">Selecionar</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Telefone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="(00) 00000-0000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">E-mail (Opcional)</label>
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Endereço (Opcional)</label>
                <input
                  type="text"
                  placeholder="Rua, Número, Bairro, Cidade"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Machine / Equipment Details */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Wrench size={16} className="text-blue-600" /> Equipamento Avaliado
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Tipo de Máquina</label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={DeviceType.Notebook}>Notebook</option>
                  <option value={DeviceType.Desktop}>Desktop / PC</option>
                  <option value={DeviceType.AllInOne}>All-in-One</option>
                  <option value={DeviceType.Other}>Outro</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Marca</label>
                <input
                  type="text"
                  placeholder="Ex: Dell, Lenovo, Acer, Asus..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={deviceBrand}
                  onChange={(e) => setDeviceBrand(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Modelo</label>
                <input
                  type="text"
                  placeholder="Ex: Inspiron 15, Nitro 5, IdeaPad..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Nº de Série / Service Tag</label>
                <input
                  type="text"
                  placeholder="Ex: SN-9823472"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Reported Defect & Technical Diagnosis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-2">
              <label className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center justify-between">
                <span>Defeito Relatado pelo Cliente *</span>
                <span className="text-[10px] text-amber-700 font-normal">O que o cliente falou</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Ex: O cliente informou que o notebook não liga, e quando liga desliga após 5 minutos jogando ou esquenta muito..."
                className="w-full bg-white border border-amber-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none font-medium"
                value={reportedProblem}
                onChange={(e) => setReportedProblem(e.target.value)}
              />
            </div>

            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80 space-y-2">
              <label className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center justify-between">
                <span>Relato Técnico / Diagnóstico após Testes</span>
                <span className="text-[10px] text-blue-700 font-normal">Após avaliação técnica</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Testado na bancada: pasta térmica ressecada e cooler obstruído por poeira (CPU atingindo 97ºC). Placa mãe íntegra. Recomendado limpeza interna, troca de pasta térmica e SSD NVMe..."
                className="w-full bg-white border border-blue-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
                value={technicalDiagnosis}
                onChange={(e) => setTechnicalDiagnosis(e.target.value)}
              />
            </div>
          </div>

          {/* Section 4: Dynamic Itemized List of Services and Products/Parts */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Package size={16} className="text-blue-600" /> Serviços & Peças/Produtos do Orçamento
                </h4>
                <p className="text-[11px] text-slate-500">
                  Adicione os serviços (mão de obra) e as peças/produtos necessários com seus respectivos preços.
                </p>
              </div>

              {/* Quick Add buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addItem('service', '', 100)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-blue-200"
                >
                  <Plus size={14} /> + Serviço
                </button>
                <button
                  type="button"
                  onClick={() => addItem('product', '', 200)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-emerald-200"
                >
                  <Plus size={14} /> + Peça/Produto
                </button>
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-blue-500" /> Sugestões Rápidas (Clique para adicionar):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SERVICES.slice(0, 4).map((srv, idx) => (
                  <button
                    key={`srv-${idx}`}
                    type="button"
                    onClick={() => addItem('service', srv.name, srv.price)}
                    className="text-[10px] bg-blue-50/80 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-medium transition-all border border-blue-100 active:scale-95"
                  >
                    + {srv.name} (R${srv.price})
                  </button>
                ))}
                {COMMON_PARTS.slice(0, 4).map((part, idx) => (
                  <button
                    key={`part-${idx}`}
                    type="button"
                    onClick={() => addItem('product', part.name, part.price)}
                    className="text-[10px] bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg font-medium transition-all border border-emerald-100 active:scale-95"
                  >
                    + {part.name} (R${part.price})
                  </button>
                ))}
              </div>
            </div>

            {/* Items Table / List */}
            <div className="space-y-2.5 pt-1">
              {items.map((item, index) => (
                <div 
                  key={item.id}
                  className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                >
                  {/* Type Selector */}
                  <select
                    value={item.type}
                    onChange={(e) => updateItem(item.id, 'type', e.target.value)}
                    className={`text-xs font-bold px-2.5 py-2 rounded-lg border appearance-none text-center sm:w-28 shrink-0 ${
                      item.type === 'service' 
                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    <option value="service">🛠️ Serviço</option>
                    <option value="product">📦 Produto</option>
                    <option value="part">⚙️ Peça</option>
                    <option value="other">Outro</option>
                  </select>

                  {/* Description Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      required
                      placeholder={item.type === 'service' ? 'Ex: Limpeza de notebook' : 'Ex: Placa mãe gigabyte B450m'}
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center gap-1 shrink-0 w-24">
                    <span className="text-[10px] font-bold text-slate-400">Qtd:</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-800 text-center focus:outline-none focus:bg-white"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="flex items-center gap-1 shrink-0 w-32">
                    <span className="text-[10px] font-bold text-slate-400">R$:</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0,00"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 text-right focus:outline-none focus:bg-white"
                    />
                  </div>

                  {/* Row Total */}
                  <div className="w-24 text-right shrink-0 hidden sm:block">
                    <span className="text-xs font-extrabold text-slate-900 block">
                      R$ {Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Remover Item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Subtotals & Total Summary Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Mão de Obra</span>
                  <span className="text-sm font-bold text-blue-700">R$ {servicesCost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Peças/Produtos</span>
                  <span className="text-sm font-bold text-emerald-700">R$ {partsCost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Desconto (R$)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0,00"
                    value={discount || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white"
                  />
                </div>
                <div className="text-right sm:border-l sm:border-slate-100 sm:pl-4">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">VALOR TOTAL ORÇADO</span>
                  <span className="text-lg font-black text-slate-900">R$ {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Photos & Initial State of Equipment */}
          <div className="space-y-3 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={16} className="text-blue-600" /> Fotos do Equipamento / Condição Inicial ({devicePhotos.length})
                </label>
                <p className="text-[11px] text-slate-500">
                  Fotos de riscos, tela, placa mãe ou peças com defeito para documentação.
                </p>
              </div>
              <label className={`
                cursor-pointer px-4 py-2 bg-white border border-slate-200 hover:border-blue-400 text-blue-600 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all
                ${compressing ? 'opacity-50 pointer-events-none' : ''}
              `}>
                {compressing ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Camera size={16} />}
                <span>{compressing ? 'Comprimindo...' : 'Anexar Fotos'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={compressing}
                />
              </label>
            </div>

            {devicePhotos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                {devicePhotos.map((photo, index) => (
                  <div key={index} className="relative group aspect-square bg-slate-200 rounded-xl overflow-hidden border border-slate-300/80 shadow-xs">
                    <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                      <button
                        type="button"
                        onClick={() => setActivePhotoModal(photo)}
                        className="p-1.5 bg-white/90 text-slate-700 rounded-lg hover:bg-white transition-colors"
                        title="Visualizar"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                      #{index + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 border border-dashed border-slate-200 rounded-xl bg-white/60 text-xs text-slate-400">
                Nenhuma foto anexada. Use a câmera ou anexe arquivos de imagens.
              </div>
            )}
          </div>

          {/* Section 6: Terms, Validity & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Status do Orçamento</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuoteStatus)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={QuoteStatus.Pending}>⏳ Em Análise / Pendente</option>
                <option value={QuoteStatus.Approved}>✅ Aprovado pelo Cliente</option>
                <option value={QuoteStatus.Rejected}>❌ Recusado pelo Cliente</option>
                <option value={QuoteStatus.Converted}>🚀 Convertido em OS</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Validade da Proposta (Dias)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 10)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Observações / Prazos (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Prazo de 2 dias após aprovação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="tech-gradient text-white px-7 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-200 hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{initialQuote ? 'Salvar Alterações' : 'Salvar Orçamento'}</span>
            </button>
          </div>
        </form>
      </motion.div>

      {/* Lightbox for photos */}
      {activePhotoModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActivePhotoModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            <button
              type="button"
              onClick={() => setActivePhotoModal(null)}
              className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full z-10"
            >
              <X size={20} />
            </button>
            <img src={activePhotoModal} alt="Ampliada" className="max-w-full max-h-[85vh] object-contain mx-auto" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
