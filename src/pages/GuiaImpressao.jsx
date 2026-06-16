import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { firestoreService } from '../lib/firestoreService';
import { Loader2 } from 'lucide-react';

export function GuiaImpressao() {
  const { id } = useParams();
  const { devolucoes } = useStore();
  
  const [devolucao, setDevolucao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchDevolucao = async () => {
      // Tenta achar no estado primeiro (se abriu via navegação normal)
      const inStore = devolucoes.find(d => d.id === id);
      if (inStore) {
        setDevolucao(inStore);
        setLoading(false);
        return;
      }

      // Se não achou (abriu em nova aba, estado zerado), busca do Firebase
      try {
        const doc = await firestoreService.getDevolucao(id);
        if (doc) {
          setDevolucao(doc);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchDevolucao();
  }, [id, devolucoes]);

  useEffect(() => {
    if (devolucao && !loading) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [devolucao, loading]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="flex flex-col items-center text-gray-500">
          <Loader2 className="animate-spin h-8 w-8 mb-2" />
          <p>Carregando dados da devolução...</p>
        </div>
      </div>
    );
  }

  if (error || !devolucao) {
    return <Navigate to="/devolucoes" />;
  }

  return (
    <div className="bg-white text-black min-h-screen p-4 max-w-3xl mx-auto font-sans text-sm print-wrapper">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider leading-none">LogisTrack</h1>
          <h2 className="text-base font-semibold mt-1 text-gray-700">Guia de Conferência de Devolução</h2>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
          <p><strong>ID:</strong> {devolucao.id}</p>
        </div>
      </div>

      <hr className="border-t border-black mb-4" />

      {/* Info Section */}
      <div className="flex justify-between mb-6">
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-bold leading-tight">Nota Fiscal</p>
          <p className="text-base font-bold">{devolucao.nota}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-bold leading-tight">Placa do Veículo</p>
          <p className="text-base font-bold">{devolucao.placa || 'Não informada'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-bold leading-tight">Data da Ocorrência</p>
          <p className="text-sm font-semibold mt-0.5">{new Date(devolucao.data).toLocaleDateString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-bold leading-tight">Tipo de Devolução</p>
          <p className="text-sm font-semibold mt-0.5">{devolucao.tipo}</p>
        </div>
      </div>

      {/* Motivo/Observação Principal */}
      <div className="mb-6">
        <p className="text-[10px] uppercase text-gray-500 font-bold leading-tight mb-0.5">Motivo / Observação Reportada</p>
        <p className="font-medium text-sm">{devolucao.observacao || 'Nenhum motivo informado.'}</p>
      </div>

      {/* Items Section */}
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase mb-2 border-b border-black pb-1">Itens Devolvidos</h3>
        {devolucao.itens && devolucao.itens.length > 0 ? (
          <table className="w-full text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-1.5 text-left">Código</th>
                <th className="border border-black p-1.5 text-left">Descrição do Produto</th>
                <th className="border border-black p-1.5 text-center">Qtd. NF</th>
                <th className="border border-black p-1.5 text-right">Peso NF (kg)</th>
                <th className="border border-black p-1.5 text-center w-24">Qtd. Recebida</th>
                <th className="border border-black p-1.5 text-center w-24">Peso Recebido</th>
              </tr>
            </thead>
            <tbody>
              {devolucao.itens.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-1.5">{item.codigo}</td>
                  <td className="border border-black p-1.5">{item.descricao}</td>
                  <td className="border border-black p-1.5 text-center">{item.qtd}</td>
                  <td className="border border-black p-1.5 text-right">{Number(item.peso).toFixed(3)}</td>
                  <td className="border border-black p-1.5 text-center bg-gray-50/50"></td>
                  <td className="border border-black p-1.5 text-center bg-gray-50/50"></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-gray-50 text-xs">
                <td colSpan="3" className="border border-black p-1.5 text-right">Totais na NF:</td>
                <td className="border border-black p-1.5 text-right">{(devolucao.quantidadeKg || 0).toFixed(3)}</td>
                <td className="border border-black p-1.5"></td>
                <td className="border border-black p-1.5"></td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="border border-black p-3 text-center text-gray-500 italic text-xs">
            Sem itens detalhados. Referência de Peso Total: {(devolucao.quantidadeKg || 0).toFixed(3)} kg.
          </div>
        )}
      </div>

      {/* Observações da Conferência Física */}
      <div className="mb-12">
        <p className="text-[10px] uppercase text-gray-500 font-bold mb-3">Anotações da Conferência Física</p>
        <div className="border-b border-dashed border-gray-400 mb-6"></div>
        <div className="border-b border-dashed border-gray-400 mb-6"></div>
        <div className="border-b border-dashed border-gray-400"></div>
      </div>

      {/* Signatures */}
      <div className="mt-12 flex justify-around items-end">
        <div className="text-center w-64">
          <div className="border-t border-black mb-1.5"></div>
          <p className="font-bold uppercase text-xs">Motorista</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Data: ___/___/20__</p>
        </div>
        
        <div className="text-center w-64">
          <div className="border-t border-black mb-1.5"></div>
          <p className="font-bold uppercase text-xs">Conferente / Operação</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Data: ___/___/20__</p>
        </div>
      </div>

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; }
          body { background: white; margin: 0; padding: 0; }
          .print-wrapper { 
            padding: 10mm; 
            width: 100%; 
            max-width: 100%; 
            box-sizing: border-box; 
            min-height: auto !important; 
            height: auto !important; 
            overflow: hidden;
          }
          .bg-white { background: white !important; }
          .text-black { color: black !important; }
          .border-black { border-color: black !important; }
          .bg-gray-100 { background: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-50 { background: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
