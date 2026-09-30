import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { firestoreService } from '../lib/firestoreService';
import { Loader2 } from 'lucide-react';
import { getTipoDevolucaoBadge } from '../data/mockData';

export function GuiaImpressao() {
  const { id } = useParams();
  const { devolucoes, currentUser } = useStore();
  
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

  const badgeInfo = getTipoDevolucaoBadge(devolucao.tipo);
  const isGramatura = badgeInfo.semRetornoFisico || devolucao.semRetornoFisico || String(devolucao.tipo || '').toLowerCase().includes('gramatura');

  return (
    <div className="bg-white text-black min-h-screen p-4 max-w-3xl mx-auto font-sans text-sm print-wrapper">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 border-b border-black pb-3">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider leading-none">LogisTrack</h1>
          <h2 className="text-sm font-bold mt-1 text-gray-800 uppercase">Guia de Conferência de Devolução</h2>
        </div>
        <div className="text-right text-xs">
          <p><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} {new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute:'2-digit'})}</p>
          <p><strong>Operador:</strong> {currentUser?.nome || currentUser?.role || 'Operação'}</p>
        </div>
      </div>

      {/* Box de Alerta se for Devolução de Gramatura */}
      {isGramatura && (
        <div className="mb-4 p-3 border-2 border-black bg-gray-100 text-black rounded">
          <p className="font-black text-xs uppercase tracking-wide">
            ⚖️ OCORRÊNCIA DE GRAMATURA / QUEBRA DE PESO (SEM RETORNO FÍSICO)
          </p>
          <p className="text-[11px] mt-0.5 leading-snug">
            Todas as caixas/volumes físicos permaneceram com o cliente. Esta devolução representa abatimento fiscal/financeiro referente à quebra de peso de <strong>{(Number(devolucao.quantidadeKg) || 0).toFixed(3)} kg</strong>. Não há caixas físicas a descarregar na doca.
          </p>
        </div>
      )}

      {/* Info Section */}
      <div className="grid grid-cols-4 gap-2 border border-black p-3 mb-4 bg-gray-50 text-xs">
        <div>
          <p className="text-[10px] uppercase text-gray-600 font-bold leading-tight">Nota Fiscal</p>
          <p className="text-sm font-black font-mono mt-0.5">{devolucao.nota}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-600 font-bold leading-tight">Placa do Veículo</p>
          <p className="text-sm font-black font-mono mt-0.5">{devolucao.placa || 'Não informada'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-600 font-bold leading-tight">Data da Ocorrência</p>
          <p className="text-sm font-semibold mt-0.5">
            {devolucao.data ? new Date(devolucao.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '--/--/----'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-gray-600 font-bold leading-tight">Tipo de Devolução</p>
          <p className="text-sm font-bold mt-0.5">{badgeInfo.label}</p>
        </div>
      </div>

      {/* Motivo/Observação Principal */}
      <div className="mb-4 border border-black p-2.5">
        <p className="text-[10px] uppercase text-gray-600 font-bold leading-tight mb-0.5">Motivo / Justificativa Reportada</p>
        <p className="font-semibold text-xs">{devolucao.observacao || 'Nenhum motivo detalhado informado.'}</p>
        {devolucao.tratamento && (
          <p className="text-[11px] text-gray-700 mt-1">
            <strong>Tratamento da Mercadoria:</strong> {devolucao.tratamento}
          </p>
        )}
      </div>

      {/* Items Section */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase mb-1.5 border-b border-black pb-1 flex justify-between items-center">
          <span>Itens / Produtos da Devolução</span>
          <span className="font-mono">Total Devolvido: {(Number(devolucao.quantidadeKg) || 0).toFixed(3)} kg</span>
        </h3>
        {devolucao.itens && devolucao.itens.length > 0 ? (
          <table className="w-full text-xs border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-1 text-left">Código</th>
                <th className="border border-black p-1 text-left">Descrição do Produto</th>
                <th className="border border-black p-1 text-center">Qtd. NF</th>
                <th className="border border-black p-1 text-right">Peso NF (kg)</th>
                <th className="border border-black p-1 text-center w-24">Qtd. Recebida</th>
                <th className="border border-black p-1 text-center w-24">Peso Recebido</th>
              </tr>
            </thead>
            <tbody>
              {devolucao.itens.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-1 font-mono">{item.codigo || '-'}</td>
                  <td className="border border-black p-1">{item.descricao}</td>
                  <td className="border border-black p-1 text-center font-mono">{item.qtd ?? 0}</td>
                  <td className="border border-black p-1 text-right font-mono">{Number(item.peso || 0).toFixed(3)}</td>
                  <td className="border border-black p-1 text-center bg-gray-50/50">
                    {isGramatura ? <span className="text-[10px] text-gray-500 font-bold">N/A (Gramatura)</span> : ''}
                  </td>
                  <td className="border border-black p-1 text-center bg-gray-50/50">
                    {isGramatura ? <span className="text-[10px] text-gray-500 font-bold">Abatido</span> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-gray-50 text-xs">
                <td colSpan="3" className="border border-black p-1 text-right">Totais Informados:</td>
                <td className="border border-black p-1 text-right font-mono">{(Number(devolucao.quantidadeKg) || 0).toFixed(3)} kg</td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="border border-black p-2.5 text-center text-gray-600 italic text-xs">
            {isGramatura 
              ? `Devolução de Gramatura Geral. Diferença de peso registrada: ${(Number(devolucao.quantidadeKg) || 0).toFixed(3)} kg (sem retorno físico de itens).`
              : `Sem itens físicos detalhados. Referência de Peso Total: ${(Number(devolucao.quantidadeKg) || 0).toFixed(3)} kg.`}
          </div>
        )}
      </div>

      {/* Observações da Conferência Física */}
      <div className="mb-8">
        <p className="text-[10px] uppercase text-gray-600 font-bold mb-2">Anotações da Conferência Física / Doca</p>
        <div className="border-b border-dashed border-gray-400 mb-5"></div>
        <div className="border-b border-dashed border-gray-400 mb-5"></div>
        <div className="border-b border-dashed border-gray-400"></div>
      </div>

      {/* Signatures */}
      <div className="mt-8 flex justify-around items-end">
        <div className="text-center w-60">
          <div className="border-t border-black mb-1"></div>
          <p className="font-bold uppercase text-[11px]">Motorista</p>
          <p className="text-[9px] text-gray-500">Data: ___/___/20__</p>
        </div>
        
        <div className="text-center w-60">
          <div className="border-t border-black mb-1"></div>
          <p className="font-bold uppercase text-[11px]">Conferente / Operação</p>
          <p className="text-[9px] text-gray-500">Data: ___/___/20__</p>
        </div>
      </div>

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 8mm; }
          body { background: white; margin: 0; padding: 0; }
          .print-wrapper { 
            padding: 0; 
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

