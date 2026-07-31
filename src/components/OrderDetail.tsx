import React, { useState } from 'react';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ServiceOrder, OrderStatus, Priority, PaymentMethod } from '../types';
import { motion } from 'motion/react';
import { X, Save, FileText, Settings, Wrench, User, Printer, Camera, Trash2, Eye, Loader2 } from 'lucide-react';
import PrintOrder from './PrintOrder';
import { compressImage } from '../lib/imageUtils';

interface OrderDetailProps {
  order: ServiceOrder;
  onClose: () => void;
}

export default function OrderDetail({ order, onClose }: OrderDetailProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(order.technicalReport || '');
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.paymentMethod || PaymentMethod.Pix);
  const [partsCost, setPartsCost] = useState(order.partsCost);
  const [serviceCost, setServiceCost] = useState(order.serviceCost);
  const [devicePhotos, setDevicePhotos] = useState<string[]>(order.devicePhotos || []);
  const [compressing, setCompressing] = useState(false);
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);

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

  const handleUpdate = async () => {
    if (!order.id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'serviceOrders', order.id), {
        technicalReport: report,
        status: status,
        paymentMethod: paymentMethod,
        partsCost: Number(partsCost),
        serviceCost: Number(serviceCost),
        totalCost: Number(partsCost) + Number(serviceCost),
        devicePhotos: devicePhotos,
        updatedAt: serverTimestamp()
      });
      if (status === OrderStatus.Completed && order.status !== OrderStatus.Completed) {
        setShowPrintPrompt(true);
      } else {
        onClose();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `serviceOrders/${order.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[70] flex items-center justify-center p-4 print:hidden"
    >
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl border border-slate-200 w-full max-w-4xl shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 md:p-8 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 text-slate-500 px-3 py-1 rounded-lg text-xs font-bold tracking-tight">#{order.orderNumber}</div>
            <h2 className="font-bold text-slate-900 tracking-tight text-lg">{order.customerName}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-2 bg-slate-50 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <InfoBlock icon={<User size={16} />} label="Cliente" value={order.customerName} subValue={order.customerPhone} />
            <InfoBlock icon={<Wrench size={16} />} label="Equipamento" value={`${order.deviceType} ${order.deviceBrand}`} subValue={order.deviceModel} />
            <InfoBlock icon={<Settings size={16} />} label="Prioridade" value={order.priority} subValue={`Entrada: ${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : '...'}`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Left Col: Problem Description */}
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Reclamação do Cliente</label>
              <div className="bg-slate-50 p-6 rounded-2xl text-slate-700 leading-relaxed">
                {order.problemDescription}
              </div>
              
              <div className="pt-6 space-y-4">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Status Atual</label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(OrderStatus).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`
                        px-4 py-2 text-[10px] font-bold rounded-xl transition-all border
                        ${status === s 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}
                      `}
                    >
                      {s === OrderStatus.Pending ? 'Pendente' : 
                       s === OrderStatus.InProgress ? 'Em Serviço' :
                       s === OrderStatus.WaitingParts ? 'Aguardando Peças' :
                       s === OrderStatus.Completed ? 'Concluído' :
                       s === OrderStatus.Canceled ? 'Cancelado' : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Technical Report & Costs */}
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Relatório Técnico</label>
              <textarea 
                rows={5}
                className="input-field resize-none py-4"
                placeholder="Detalhes internos e solução aplicada..."
                value={report}
                onChange={e => setReport(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 tracking-tight">Forma de Pagamento</label>
                  <select 
                    className="input-field"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  >
                    {Object.values(PaymentMethod).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 tracking-tight">Garantia (Meses)</label>
                  <div className="input-field flex items-center bg-slate-50 opacity-50 cursor-not-allowed">
                    <span className="text-xs">3 Meses (Fix)</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 tracking-tight">Serviço (R$)</label>
                  <input 
                    type="number"
                    className="input-field font-bold"
                    value={serviceCost}
                    onChange={e => setServiceCost(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1 tracking-tight">Peças (R$)</label>
                  <input 
                    type="number"
                    className="input-field font-bold"
                    value={partsCost}
                    onChange={e => setPartsCost(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Photos Management Section */}
          <div className="space-y-3 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={16} className="text-blue-600" /> Registro Fotográfico do Equipamento ({devicePhotos.length})
                </label>
                <p className="text-[11px] text-slate-500">
                  Fotos salvas para comprovação e inclusão automática no PDF/Comprovante impresso.
                </p>
              </div>
              <label className={`
                cursor-pointer px-4 py-2 bg-white border border-slate-200 hover:border-blue-400 text-blue-600 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all
                ${compressing ? 'opacity-50 pointer-events-none' : ''}
              `}>
                {compressing ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Camera size={16} />}
                <span>{compressing ? 'Processando...' : 'Adicionar Foto'}</span>
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
                Nenhuma foto registrada para esta OS. Clique em "Adicionar Foto" para anexar imagens da entrada/estado do produto.
              </div>
            )}
          </div>
        </div>

        <div className="p-8 flex justify-between items-center border-t border-slate-100 bg-slate-50/50">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Valor Final</span>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">R$ {(Number(partsCost) + Number(serviceCost)).toFixed(2)}</span>
          </div>

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => setShowPrint(true)}
              className="px-5 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors rounded-xl font-bold flex items-center gap-2 text-xs"
            >
              <Printer size={16} />
              IMPRIMIR / PDF
            </button>
            <button onClick={onClose} className="px-6 py-3 font-semibold text-slate-500 hover:bg-slate-200/50 transition-colors rounded-xl font-mono text-xs">// CANCELAR</button>
            <button 
              onClick={handleUpdate}
              disabled={loading}
              className="tech-gradient text-white px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              <Save size={18} />
              {loading ? 'SINCRONIZANDO...' : 'SALVAR ALTERAÇÕES'}
            </button>
          </div>
        </div>
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

      {/* Print prompt overlay (when marked ready/completed) */}
      {showPrintPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 print:hidden">
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl border border-slate-200"
          >
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto text-3xl font-extrabold animate-bounce">
              🎉
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 tracking-tight text-xl">Ordem de Serviço Concluída!</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium">Esta Ordem de Serviço foi atualizada para "Concluído" com sucesso. Deseja imprimir o comprovante ou gerar o PDF para o cliente agora?</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPrintPrompt(false);
                  setShowPrint(true);
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                <Printer size={14} /> IMPRIMIR / PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPrintPrompt(false);
                  onClose();
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors"
              >
                NÃO, SÓ FECHAR
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Print preview overlay */}
      {showPrint && (
        <PrintOrder order={{
          ...order,
          status,
          technicalReport: report,
          paymentMethod,
          partsCost: Number(partsCost),
          serviceCost: Number(serviceCost),
          totalCost: Number(partsCost) + Number(serviceCost),
          devicePhotos
        }} onClose={() => {
          setShowPrint(false);
          if (status === OrderStatus.Completed && order.status !== OrderStatus.Completed) {
            onClose();
          }
        }} />
      )}
    </motion.div>
  );
}

function InfoBlock({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string, subValue?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 tracking-widest uppercase">
        {icon} {label}
      </div>
      <div className="font-bold text-slate-900 tracking-tight">{value}</div>
      {subValue && <div className="text-xs text-slate-500 font-medium">{subValue}</div>}
    </div>
  );
}
