import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Quote, QuoteStatus, DeviceType, ServiceOrder, OrderStatus, Priority } from '../types';
import { Plus, Search, Filter, FileText, Printer, Edit2, Trash2, ArrowRightCircle, CheckCircle2, Clock, DollarSign, MessageSquare, Wrench, Package, Sparkles, AlertCircle, Eye, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QuoteForm from './QuoteForm';
import QuoteDetail from './QuoteDetail';
import PrintQuote from './PrintQuote';

interface QuotesProps {
  onNavigateToOrders?: (orderId?: string) => void;
}

export default function Quotes({ onNavigateToOrders }: QuotesProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [printingQuote, setPrintingQuote] = useState<Quote | null>(null);

  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [convertingLoading, setConvertingLoading] = useState(false);
  const [convertToast, setConvertToast] = useState<{ quoteNumber: string; orderNumber: string; orderId: string } | null>(null);

  // Subscribe to Firestore quotes
  useEffect(() => {
    const q = query(
      collection(db, 'quotes'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      setQuotes(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Quick Convert to Service Order
  const handleQuickConvert = async (quoteToConvert: Quote) => {
    if (!quoteToConvert.id || !auth.currentUser) return;
    setConvertingLoading(true);

    try {
      const currentYear = new Date().getFullYear();
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const newOrderNumber = `OS-${currentYear}-${randomSeq}`;

      const itemsListText = quoteToConvert.items && quoteToConvert.items.length > 0
        ? quoteToConvert.items.map(i => `• [${i.type === 'service' ? 'SERVIÇO' : 'PEÇA'}] ${i.description} (${i.quantity}x R$ ${Number(i.unitPrice || 0).toFixed(2)})`).join('\n')
        : '';

      const technicalReportText = [
        quoteToConvert.technicalDiagnosis ? `[DIAGNÓSTICO TÉCNICO INICIAL]:\n${quoteToConvert.technicalDiagnosis}` : '',
        itemsListText ? `\n[ITENS APROVADOS NO ORÇAMENTO #${quoteToConvert.quoteNumber}]:\n${itemsListText}` : '',
        quoteToConvert.notes ? `\n[OBSERVAÇÕES DO CLIENTE]:\n${quoteToConvert.notes}` : ''
      ].filter(Boolean).join('\n');

      const serviceOrderData = {
        orderNumber: newOrderNumber,
        customerId: quoteToConvert.customerId || null,
        customerName: quoteToConvert.customerName,
        customerPhone: quoteToConvert.customerPhone,
        deviceType: quoteToConvert.deviceType,
        deviceBrand: quoteToConvert.deviceBrand || '',
        deviceModel: quoteToConvert.deviceModel || '',
        serialNumber: quoteToConvert.serialNumber || '',
        problemDescription: quoteToConvert.reportedProblem || 'Conforme orçamento prévio aprovado.',
        technicalReport: technicalReportText,
        devicePhotos: quoteToConvert.devicePhotos || [],
        status: OrderStatus.Pending,
        priority: Priority.Normal,
        partsCost: Number(quoteToConvert.partsCost || 0),
        serviceCost: Number(quoteToConvert.servicesCost || 0),
        totalCost: Number(quoteToConvert.totalAmount || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      };

      const newOrderRef = await addDoc(collection(db, 'serviceOrders'), serviceOrderData);

      // Update quote
      await updateDoc(doc(db, 'quotes', quoteToConvert.id), {
        status: QuoteStatus.Converted,
        convertedOrderId: newOrderRef.id,
        convertedOrderNumber: newOrderNumber,
        updatedAt: serverTimestamp()
      });

      setConvertingQuote(null);
      setConvertToast({
        quoteNumber: quoteToConvert.quoteNumber,
        orderNumber: newOrderNumber,
        orderId: newOrderRef.id
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'serviceOrders');
    } finally {
      setConvertingLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, qId: string, qNum: string) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir o orçamento #${qNum}?`)) return;
    try {
      await deleteDoc(doc(db, 'quotes', qId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `quotes/${qId}`);
    }
  };

  // Filter quotes
  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = 
      q.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customerPhone?.includes(searchTerm) ||
      q.deviceBrand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.deviceModel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.reportedProblem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.items?.some(i => i.description?.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return q.status === QuoteStatus.Pending;
    if (statusFilter === 'approved') return q.status === QuoteStatus.Approved;
    if (statusFilter === 'converted') return q.status === QuoteStatus.Converted;
    if (statusFilter === 'rejected') return q.status === QuoteStatus.Rejected;

    return true;
  });

  // Calculate Metrics
  const totalCount = quotes.length;
  const pendingCount = quotes.filter(q => q.status === QuoteStatus.Pending).length;
  const approvedCount = quotes.filter(q => q.status === QuoteStatus.Approved || q.status === QuoteStatus.Converted).length;
  const totalAmountSum = quotes
    .filter(q => q.status !== QuoteStatus.Rejected)
    .reduce((sum, q) => sum + (Number(q.totalAmount) || 0), 0);

  const getStatusBadge = (st: QuoteStatus) => {
    switch (st) {
      case QuoteStatus.Pending:
        return <span className="bg-amber-50 text-amber-700 border border-amber-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">⏳ Em Análise</span>;
      case QuoteStatus.Approved:
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">✅ Aprovado</span>;
      case QuoteStatus.Converted:
        return <span className="bg-blue-50 text-blue-700 border border-blue-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">🚀 Convertido em OS</span>;
      case QuoteStatus.Rejected:
        return <span className="bg-rose-50 text-rose-700 border border-rose-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">❌ Recusado</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[11px] font-bold">{st}</span>;
    }
  };

  const getDeviceIcon = (type: DeviceType) => {
    return '💻';
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Orçamentos de Serviços & Produtos
          </h2>
          <p className="text-slate-500 font-medium text-sm sm:text-base">
            Elabore propostas, discrimine peças e converta em Ordem de Serviço com 1 clique
          </p>
        </div>

        <button 
          onClick={() => setShowNewModal(true)}
          className="flex items-center justify-center gap-2 tech-gradient text-white px-6 py-3.5 rounded-2xl font-bold transition-all active:scale-95 group shadow-lg shadow-blue-100 cursor-pointer"
        >
          <Plus size={22} className="transition-transform group-hover:rotate-90" />
          <span>Novo Orçamento</span>
        </button>
      </header>

      {/* Success Banner when Quote is Converted */}
      {convertToast && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h4 className="font-extrabold text-emerald-950 text-sm">
                Ordem de Serviço #{convertToast.orderNumber} Criada com Sucesso!
              </h4>
              <p className="text-xs text-emerald-800">
                O orçamento #{convertToast.quoteNumber} foi convertido em uma OS pronta para execução.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToOrders && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToOrders(convertToast.orderId);
                  setConvertToast(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-xs"
              >
                Ver na Aba de OS
              </button>
            )}
            <button
              type="button"
              onClick={() => setConvertToast(null)}
              className="p-1.5 text-emerald-700 hover:text-emerald-900 rounded-lg"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Propostas</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-slate-900">{totalCount}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
              <FileText size={16} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Em Análise / Pendentes</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              <Clock size={16} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Aprovados / Convertidos</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-emerald-600">{approvedCount}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <CheckCircle2 size={16} />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Total em Propostas (R$)</span>
          <div className="flex items-center justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900">R$ {totalAmountSum.toFixed(2)}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <DollarSign size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, nº do orçamento, marca, defeito, peça..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendentes' },
            { key: 'approved', label: 'Aprovados' },
            { key: 'converted', label: 'Convertidos em OS' },
            { key: 'rejected', label: 'Recusados' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === f.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <span>Carregando orçamentos...</span>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <FileText size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">Nenhum orçamento encontrado</h3>
            <p className="text-xs text-slate-500">
              {searchTerm 
                ? 'Nenhum resultado corresponde à sua busca.' 
                : 'Crie propostas comerciais de serviços e produtos para seus clientes com cálculo automático.'}
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="tech-gradient text-white px-6 py-3 rounded-xl font-bold text-xs inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={16} /> Criar Primeiro Orçamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotes.map((q) => {
            const cleanPhone = q.customerPhone?.replace(/\D/g, '');
            const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
              `Olá ${q.customerName}! Aqui é da RibLab TI. Segue o orçamento #${q.quoteNumber} para o seu ${q.deviceBrand} ${q.deviceModel}: Total R$ ${Number(q.totalAmount).toFixed(2)}.`
            )}`;

            const servicesCount = q.items?.filter(i => i.type === 'service').length || 0;
            const partsCount = q.items?.filter(i => i.type !== 'service').length || 0;

            return (
              <motion.div
                key={q.id}
                layout
                onClick={() => setSelectedQuote(q)}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                {/* Top Row: Quote Number, Status, Actions */}
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg">
                        #{q.quoteNumber}
                      </span>
                      {getStatusBadge(q.status)}
                    </div>

                    {/* Fast Action Buttons */}
                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrintingQuote(q);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Imprimir / Salvar PDF"
                      >
                        <Printer size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingQuote(q);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, q.id!, q.quoteNumber)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Customer & Machine Info */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                        {q.customerName}
                      </h4>
                      {cleanPhone && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1"
                        >
                          <MessageSquare size={12} /> WhatsApp
                        </a>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <Wrench size={13} className="text-slate-400" />
                      <span>{q.deviceType}: {q.deviceBrand} {q.deviceModel}</span>
                    </p>
                  </div>

                  {/* Defect preview */}
                  <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-xs">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Defeito Informado:</p>
                    <p className="text-slate-700 line-clamp-2 leading-relaxed">
                      "{q.reportedProblem || 'Não detalhado.'}"
                    </p>
                  </div>

                  {/* Items Chips Preview */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {servicesCount > 0 && (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md">
                        🛠️ {servicesCount} {servicesCount === 1 ? 'serviço' : 'serviços'}
                      </span>
                    )}
                    {partsCount > 0 && (
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md">
                        📦 {partsCount} {partsCount === 1 ? 'peça/produto' : 'peças/produtos'}
                      </span>
                    )}
                    {q.devicePhotos && q.devicePhotos.length > 0 && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        📷 {q.devicePhotos.length} fotos
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Total Price and Convert Button */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Orçado</span>
                    <span className="text-lg font-black text-slate-900">
                      R$ {Number(q.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Convert to OS Action Button */}
                  {q.status === QuoteStatus.Converted ? (
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                      <Check size={14} /> OS #{q.convertedOrderNumber || 'Ativa'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConvertingQuote(q);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      title="Gerar Ordem de Serviço automaticamente a partir deste orçamento"
                    >
                      <ArrowRightCircle size={15} />
                      <span>Gerar OS</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Convert to OS Confirmation Modal */}
      {convertingQuote && (
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
                Você está gerando uma nova <strong>Ordem de Serviço (OS)</strong> para o cliente <strong>{convertingQuote.customerName}</strong> com o valor total de <strong>R$ {Number(convertingQuote.totalAmount).toFixed(2)}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><strong>Aparelho:</strong> {convertingQuote.deviceBrand} {convertingQuote.deviceModel}</p>
              <p><strong>Total:</strong> R$ {Number(convertingQuote.totalAmount).toFixed(2)}</p>
              <p><strong>Itens:</strong> {convertingQuote.items?.length || 0} discriminados</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConvertingQuote(null)}
                disabled={convertingLoading}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleQuickConvert(convertingQuote)}
                disabled={convertingLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {convertingLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{convertingLoading ? 'Gerando OS...' : 'Confirmar e Criar OS'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* New Quote Form Modal */}
      {showNewModal && (
        <QuoteForm 
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* Edit Quote Form Modal */}
      {editingQuote && (
        <QuoteForm 
          initialQuote={editingQuote}
          onClose={() => setEditingQuote(null)}
        />
      )}

      {/* Quote Detail View Modal */}
      {selectedQuote && (
        <QuoteDetail
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onOrderCreated={(orderId) => {
            if (onNavigateToOrders) onNavigateToOrders(orderId);
          }}
        />
      )}

      {/* Print / PDF Modal */}
      {printingQuote && (
        <PrintQuote 
          quote={printingQuote}
          onClose={() => setPrintingQuote(null)}
        />
      )}
    </div>
  );
}
