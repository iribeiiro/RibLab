import React, { useState } from 'react';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Quote, QuoteStatus, ServiceOrder, OrderStatus, Priority } from '../types';
import { X, Printer, Edit2, Trash2, ArrowRightCircle, CheckCircle2, AlertCircle, Phone, MessageSquare, Wrench, Package, FileText, Calendar, DollarSign, Loader2, Sparkles, Check, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PrintQuote from './PrintQuote';
import QuoteForm from './QuoteForm';

interface QuoteDetailProps {
  quote: Quote;
  onClose: () => void;
  onOrderCreated?: (orderId: string) => void;
}

export default function QuoteDetail({ quote, onClose, onOrderCreated }: QuoteDetailProps) {
  const [currentQuote, setCurrentQuote] = useState<Quote>(quote);
  const [status, setStatus] = useState<QuoteStatus>(quote.status);
  const [loading, setLoading] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertedSuccess, setConvertedSuccess] = useState<{ id: string; orderNumber: string } | null>(
    quote.convertedOrderId ? { id: quote.convertedOrderId, orderNumber: quote.convertedOrderNumber || '' } : null
  );
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!currentQuote.id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'quotes', currentQuote.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setStatus(newStatus);
      setCurrentQuote(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `quotes/${currentQuote.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentQuote.id) return;
    if (!window.confirm(`Tem certeza que deseja excluir o orçamento #${currentQuote.quoteNumber}?`)) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'quotes', currentQuote.id));
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `quotes/${currentQuote.id}`);
      setLoading(false);
    }
  };

  // Convert Quote directly into a Service Order
  const handleConvertToServiceOrder = async () => {
    if (!currentQuote.id || !auth.currentUser) return;
    setConverting(true);

    try {
      const currentYear = new Date().getFullYear();
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const newOrderNumber = `OS-${currentYear}-${randomSeq}`;

      // Build consolidated technical report from diagnosis and approved items
      const itemsListText = currentQuote.items && currentQuote.items.length > 0
        ? currentQuote.items.map(i => `• [${i.type === 'service' ? 'SERVIÇO' : 'PEÇA'}] ${i.description} (${i.quantity}x R$ ${Number(i.unitPrice || 0).toFixed(2)})`).join('\n')
        : '';

      const technicalReportText = [
        currentQuote.technicalDiagnosis ? `[DIAGNÓSTICO TÉCNICO INICIAL]:\n${currentQuote.technicalDiagnosis}` : '',
        itemsListText ? `\n[ITENS APROVADOS NO ORÇAMENTO #${currentQuote.quoteNumber}]:\n${itemsListText}` : '',
        currentQuote.notes ? `\n[OBSERVAÇÕES DO CLIENTE]:\n${currentQuote.notes}` : ''
      ].filter(Boolean).join('\n');

      const serviceOrderData = {
        orderNumber: newOrderNumber,
        customerId: currentQuote.customerId || null,
        customerName: currentQuote.customerName,
        customerPhone: currentQuote.customerPhone,
        deviceType: currentQuote.deviceType,
        deviceBrand: currentQuote.deviceBrand || '',
        deviceModel: currentQuote.deviceModel || '',
        serialNumber: currentQuote.serialNumber || '',
        problemDescription: currentQuote.reportedProblem || 'Conforme orçamento prévio aprovado.',
        technicalReport: technicalReportText,
        devicePhotos: currentQuote.devicePhotos || [],
        status: OrderStatus.Pending,
        priority: Priority.Normal,
        partsCost: Number(currentQuote.partsCost || 0),
        serviceCost: Number(currentQuote.servicesCost || 0),
        totalCost: Number(currentQuote.totalAmount || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      };

      const newOrderRef = await addDoc(collection(db, 'serviceOrders'), serviceOrderData);

      // Update quote state to converted
      await updateDoc(doc(db, 'quotes', currentQuote.id), {
        status: QuoteStatus.Converted,
        convertedOrderId: newOrderRef.id,
        convertedOrderNumber: newOrderNumber,
        updatedAt: serverTimestamp()
      });

      setStatus(QuoteStatus.Converted);
      setCurrentQuote(prev => ({
        ...prev,
        status: QuoteStatus.Converted,
        convertedOrderId: newOrderRef.id,
        convertedOrderNumber: newOrderNumber
      }));

      setConvertedSuccess({ id: newOrderRef.id, orderNumber: newOrderNumber });
      setShowConvertModal(false);

      if (onOrderCreated) {
        onOrderCreated(newOrderRef.id);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'serviceOrders');
    } finally {
      setConverting(false);
    }
  };

  const getStatusBadge = (st: QuoteStatus) => {
    switch (st) {
      case QuoteStatus.Pending:
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold">⏳ Em Análise / Pendente</span>;
      case QuoteStatus.Approved:
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">✅ Aprovado pelo Cliente</span>;
      case QuoteStatus.Rejected:
        return <span className="bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold">❌ Recusado</span>;
      case QuoteStatus.Converted:
        return <span className="bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold">🚀 Convertido em OS</span>;
      default:
        return null;
    }
  };

  const cleanPhone = currentQuote.customerPhone.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
    `Olá ${currentQuote.customerName}! Aqui é da RibLab TI. Segue a proposta do seu orçamento #${currentQuote.quoteNumber} para o seu ${currentQuote.deviceBrand} ${currentQuote.deviceModel}: Valor Total: R$ ${Number(currentQuote.totalAmount).toFixed(2)}. Fico à disposição para tirar qualquer dúvida!`
  )}`;

  return (
    <>
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
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl tech-gradient text-white flex items-center justify-center shadow-md">
                <FileText size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 tracking-tight text-xl">
                    Orçamento #{currentQuote.quoteNumber}
                  </h3>
                  {getStatusBadge(status)}
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {currentQuote.customerName} • {currentQuote.deviceBrand} {currentQuote.deviceModel}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPrint(true)}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Printer size={15} />
                <span>Imprimir / PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="px-3.5 py-2 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Edit2 size={15} />
                <span>Editar</span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Excluir Orçamento"
              >
                <Trash2 size={18} />
              </button>

              <button 
                type="button"
                onClick={onClose} 
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors ml-1"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            
            {/* Conversion Banner (if already converted or converted successfully) */}
            {convertedSuccess && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-blue-950 text-sm">
                      Ordem de Serviço #{convertedSuccess.orderNumber} Ativa!
                    </h4>
                    <p className="text-xs text-blue-700">
                      Este orçamento foi aprovado e transformado em uma Ordem de Serviço no sistema.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-blue-600 text-white px-3.5 py-1.5 rounded-xl shadow-xs">
                  OS Vinculada
                </span>
              </div>
            )}

            {/* If NOT converted yet: Conversion Highlight Box */}
            {!convertedSuccess && (
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Sparkles size={18} className="text-emerald-600" />
                    Cliente decidiu fazer o serviço?
                  </h4>
                  <p className="text-xs text-slate-600 max-w-xl">
                    Clique no botão ao lado para <strong>gerar uma Ordem de Serviço automaticamente</strong> com todos os dados do cliente, aparelho, laudo dos testes e valores discriminados.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowConvertModal(true)}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowRightCircle size={18} />
                  <span>Gerar Ordem de Serviço</span>
                </button>
              </div>
            )}

            {/* Quick Status Pill selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Atualizar Status do Orçamento:
              </span>
              <div className="flex flex-wrap gap-2">
                {[QuoteStatus.Pending, QuoteStatus.Approved, QuoteStatus.Rejected].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      status === st
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer & Machine Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Box */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" /> Cliente
                  </h4>
                  {cleanPhone && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <MessageSquare size={14} /> Enviar no WhatsApp
                    </a>
                  )}
                </div>
                <div className="space-y-1 text-xs text-slate-700">
                  <p className="text-sm font-extrabold text-slate-900">{currentQuote.customerName}</p>
                  <p className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {currentQuote.customerPhone}</p>
                  {currentQuote.customerEmail && <p className="text-slate-500">{currentQuote.customerEmail}</p>}
                  {currentQuote.customerAddress && <p className="text-slate-500">{currentQuote.customerAddress}</p>}
                </div>
              </div>

              {/* Machine Box */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Wrench size={16} className="text-blue-600" /> Equipamento Avaliado
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Tipo:</span>
                    <span className="font-bold text-slate-900">{currentQuote.deviceType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Marca / Modelo:</span>
                    <span className="font-bold text-slate-900">{currentQuote.deviceBrand} {currentQuote.deviceModel}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Nº de Série / Tag:</span>
                    <span className="font-mono text-slate-600">{currentQuote.serialNumber || 'Não informado'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Problem Reported & Technical Diagnosis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200/80 space-y-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Defeito Relatado pelo Cliente
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-100 font-medium">
                  {currentQuote.reportedProblem || 'Não informado.'}
                </p>
              </div>

              <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-200/80 space-y-2">
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  Relato Técnico / Diagnóstico dos Testes
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-xl border border-blue-100 font-medium">
                  {currentQuote.technicalDiagnosis || 'Em análise técnica preliminar.'}
                </p>
              </div>
            </div>

            {/* Itemized Table of Services & Products */}
            <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Package size={16} className="text-blue-600" /> Discriminação de Serviços e Produtos
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left bg-white rounded-xl overflow-hidden border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-20">Tipo</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3 text-center w-16">Qtd</th>
                      <th className="p-3 text-right w-28">Unitário</th>
                      <th className="p-3 text-right w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentQuote.items && currentQuote.items.length > 0 ? (
                      currentQuote.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="p-3">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              item.type === 'service'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {item.type === 'service' ? 'Serviço' : 'Produto'}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-800">{item.description}</td>
                          <td className="p-3 text-center text-slate-600 font-bold">{item.quantity}</td>
                          <td className="p-3 text-right text-slate-600 font-mono">R$ {Number(item.unitPrice || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-extrabold text-slate-900 font-mono">
                            R$ {Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">Nenhum item informado</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals Breakdown */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Mão de Obra</span>
                  <span className="text-sm font-bold text-blue-700">R$ {(currentQuote.servicesCost || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Peças e Produtos</span>
                  <span className="text-sm font-bold text-emerald-700">R$ {(currentQuote.partsCost || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Desconto</span>
                  <span className="text-sm font-bold text-rose-600">R$ {(currentQuote.discount || 0).toFixed(2)}</span>
                </div>
                <div className="text-right sm:border-l sm:border-slate-100 sm:pl-4">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">VALOR TOTAL</span>
                  <span className="text-lg font-black text-slate-900">R$ {(currentQuote.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Photos of Equipment if attached */}
            {currentQuote.devicePhotos && currentQuote.devicePhotos.length > 0 && (
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" /> Registro Fotográfico ({currentQuote.devicePhotos.length})
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {currentQuote.devicePhotos.map((photo, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setActivePhotoModal(photo)}
                      className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer shadow-2xs"
                    >
                      <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye size={18} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes & Validity */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-blue-600" />
                <span>Validade da Proposta: <strong>{currentQuote.validityDays || 10} dias</strong></span>
              </div>
              {currentQuote.notes && (
                <span className="text-slate-500 italic">Obs: {currentQuote.notes}</span>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/70 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Fechar
            </button>

            <div className="flex items-center gap-3">
              {!convertedSuccess && (
                <button
                  type="button"
                  onClick={() => setShowConvertModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowRightCircle size={16} />
                  <span>Gerar OS Automática</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPrint(true)}
                className="tech-gradient text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Printer size={16} />
                <span>Imprimir Orçamento</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Convert to OS Confirmation Dialog */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-left space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <Sparkles size={24} />
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-900 text-lg">
                Gerar Ordem de Serviço?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta ação criará uma nova <strong>Ordem de Serviço (OS)</strong> automaticamente vinculada ao cliente <strong>{currentQuote.customerName}</strong> com todos os itens, diagnóstico dos testes e valores aprovados (R$ {Number(currentQuote.totalAmount).toFixed(2)}).
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><strong>Aparelho:</strong> {currentQuote.deviceBrand} {currentQuote.deviceModel}</p>
              <p><strong>Valor Total:</strong> R$ {Number(currentQuote.totalAmount).toFixed(2)}</p>
              <p><strong>Itens incluídos:</strong> {currentQuote.items?.length || 0} itens discriminados</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                disabled={converting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConvertToServiceOrder}
                disabled={converting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {converting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{converting ? 'Gerando OS...' : 'Confirmar e Gerar OS'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Form Modal */}
      {showEdit && (
        <QuoteForm 
          initialQuote={currentQuote}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
          }}
        />
      )}

      {/* Print / PDF Modal */}
      {showPrint && (
        <PrintQuote 
          quote={currentQuote}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* Lightbox photo viewer */}
      {activePhotoModal && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[90] flex items-center justify-center p-4 cursor-pointer"
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
    </>
  );
}
