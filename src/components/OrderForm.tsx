import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { DeviceType, OrderStatus, Priority, ServiceOrder, PaymentMethod, Customer } from '../types';
import { motion } from 'motion/react';
import { Save, X, User, Cpu, FileText, Plus, Search, ChevronRight, Camera, Image as ImageIcon, Trash2, Loader2, Eye } from 'lucide-react';
import { compressImage } from '../lib/imageUtils';

interface OrderFormProps {
  onClose: () => void;
}

export default function OrderForm({ onClose }: OrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [devicePhotos, setDevicePhotos] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);

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
      console.error("Error processing photo", err);
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setDevicePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    deviceType: DeviceType.Notebook,
    deviceBrand: '',
    deviceModel: '',
    serialNumber: '',
    problemDescription: '',
    priority: Priority.Normal,
    status: OrderStatus.Pending,
    paymentMethod: PaymentMethod.Pix,
    serviceCost: 0,
    partsCost: 0
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
        setCustomers(data);
      } catch (error) {
        console.error("Error fetching customers for OS", error);
      }
    };
    fetchCustomers();
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone
    }));
    setSelectedCustomerId(customer.id || null);
    setShowCustomerResults(false);
    setCustomerSearch(customer.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      const orderNumber = Math.floor(1000 + Math.random() * 9000).toString(); // Simple numeric code
      
      const newOrder: Omit<ServiceOrder, 'id'> = {
        orderNumber,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerId: selectedCustomerId || undefined,
        deviceType: formData.deviceType,
        deviceBrand: formData.deviceBrand,
        deviceModel: formData.deviceModel,
        serialNumber: formData.serialNumber,
        problemDescription: formData.problemDescription,
        devicePhotos: devicePhotos,
        status: formData.status,
        priority: formData.priority,
        paymentMethod: formData.paymentMethod,
        partsCost: Number(formData.partsCost),
        serviceCost: Number(formData.serviceCost),
        totalCost: Number(formData.partsCost) + Number(formData.serviceCost),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      };

      await addDoc(collection(db, 'serviceOrders'), newOrder);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'serviceOrders');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  ).slice(0, 5);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 md:p-8 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 tracking-tight">Nova Ordem de Serviço</h2>
              <p className="text-xs text-slate-500 font-medium">Preencha os dados básicos do equipamento</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-2 bg-slate-50 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informações do Cliente</label>
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      className="input-field pl-10"
                      placeholder="Pesquisar cliente cadastrado..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerResults(true);
                        if (!e.target.value) {
                          setSelectedCustomerId(null);
                          setFormData(prev => ({ ...prev, customerName: '', customerPhone: '' }));
                        }
                      }}
                      onFocus={() => setShowCustomerResults(true)}
                    />
                  </div>
                </div>

                {showCustomerResults && customerSearch.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between group transition-colors"
                        >
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{c.name}</div>
                            <div className="text-xs text-slate-500">{c.phone}</div>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-4 text-center text-xs text-slate-400 italic">
                        Nenhum cliente encontrado. Preencha manualmente abaixo.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputWrapper label="Nome Completo">
                  <input required className="input-field" value={formData.customerName} onChange={e => {
                    setFormData({...formData, customerName: e.target.value});
                    setCustomerSearch(e.target.value);
                  }} placeholder="Ex: Roberto Silva" />
                </InputWrapper>
                <InputWrapper label="Telefone">
                  <input required className="input-field" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} placeholder="(00) 00000-0000" />
                </InputWrapper>
              </div>
            </div>

            <div className="space-y-4 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalhes do Equipamento</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputWrapper label="Tipo">
                  <select className="input-field appearance-none" value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value as DeviceType})}>
                    {Object.values(DeviceType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </InputWrapper>
                <InputWrapper label="Marca">
                  <input className="input-field" value={formData.deviceBrand} onChange={e => setFormData({...formData, deviceBrand: e.target.value})} placeholder="Dell, HP..." />
                </InputWrapper>
                <InputWrapper label="Modelo">
                  <input className="input-field" value={formData.deviceModel} onChange={e => setFormData({...formData, deviceModel: e.target.value})} placeholder="Inspiron 15..." />
                </InputWrapper>
                <InputWrapper label="Serial/ID">
                  <input className="input-field" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} />
                </InputWrapper>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Relato do Problema</label>
              <textarea required rows={3} className="input-field resize-none py-3" placeholder="O que está acontecendo com o equipamento?" value={formData.problemDescription} onChange={e => setFormData({...formData, problemDescription: e.target.value})} />
            </div>

            {/* Photos Section */}
            <div className="space-y-3 md:col-span-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera size={16} className="text-blue-600" /> Fotos do Equipamento / Estado Físico
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Anexe fotos do estado do produto (riscos, avarias, teclado, tela) para comprovação na OS / PDF.
                  </p>
                </div>
                <label className={`
                  cursor-pointer px-4 py-2 bg-white border border-slate-200 hover:border-blue-400 text-blue-600 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all
                  ${compressing ? 'opacity-50 pointer-events-none' : ''}
                `}>
                  {compressing ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Camera size={16} />}
                  <span>{compressing ? 'Processando...' : 'Adicionar Fotos'}</span>
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
                <div className="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-white/60 text-xs text-slate-400">
                  Nenhuma foto anexada. Clique em "Adicionar Fotos" ou tire fotos com a câmera do celular/computador.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:col-span-2">
              <InputWrapper label="Status">
                <select className="input-field appearance-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as OrderStatus})}>
                  <option value={OrderStatus.Pending}>Pendente</option>
                  <option value={OrderStatus.InProgress}>Em Serviço</option>
                  <option value={OrderStatus.WaitingParts}>Aguardando Peças</option>
                  <option value={OrderStatus.Completed}>Concluído</option>
                </select>
              </InputWrapper>
              <InputWrapper label="Pagamento">
                <select className="input-field appearance-none" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value as PaymentMethod})}>
                  {Object.values(PaymentMethod).map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </InputWrapper>
              <InputWrapper label="Mão de Obra">
                <input type="number" className="input-field" value={formData.serviceCost} onChange={e => setFormData({...formData, serviceCost: Number(e.target.value)})} />
              </InputWrapper>
              <InputWrapper label="Peças">
                <input type="number" className="input-field" value={formData.partsCost} onChange={e => setFormData({...formData, partsCost: Number(e.target.value)})} />
              </InputWrapper>
              <div className="flex flex-col justify-center bg-blue-50/50 rounded-xl px-4 border border-blue-100">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Total Estimado</span>
                <span className="text-xl font-bold text-blue-700">R$ {(Number(formData.serviceCost) + Number(formData.partsCost)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-semibold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-50 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Criar Ordem'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Lightbox photo viewer */}
      {activePhotoModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActivePhotoModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            <button
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

function InputWrapper({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">{label}</label>
      {children}
    </div>
  );
}
