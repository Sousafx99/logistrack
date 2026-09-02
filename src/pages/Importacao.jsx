import { useState, useMemo, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, Trash2, DownloadCloud, Database, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';

export function Importacao() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { novas: 0, atualizadas: 0 }
  const { entregas, devolucoes, importarEntregas, removerEntregasPorData, restaurarBackup } = useStore();
  
  const [dataParaExcluir, setDataParaExcluir] = useState(null);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [erroSenha, setErroSenha] = useState('');

  const datasImportadas = useMemo(() => {
    const stats = {};
    entregas.forEach(e => {
      if (e.data) {
        if (!stats[e.data]) stats[e.data] = 0;
        stats[e.data]++;
      }
    });
    return Object.keys(stats).sort((a,b) => b.localeCompare(a)).map(data => ({
      data,
      count: stats[data]
    }));
  }, [entregas]);

  const handleExcluirData = () => {
    if (senhaExclusao === '@rj2026') {
      removerEntregasPorData(dataParaExcluir);
      setDataParaExcluir(null);
      setSenhaExclusao('');
      setErroSenha('');
    } else {
      setErroSenha('Senha incorreta.');
    }
  };

  const backupInputRef = useRef(null);
  const [restaurando, setRestaurando] = useState(false);

  const handleExportarBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      entregas,
      devolucoes
    };
    const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LogisTrack_Backup_${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportarBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setRestaurando(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        if (!backupData.entregas && !backupData.devolucoes) {
          throw new Error('Arquivo de backup inválido.');
        }
        await restaurarBackup(backupData);
        alert('Backup restaurado com sucesso! Os dados foram mesclados na nuvem.');
      } catch (err) {
        console.error(err);
        alert('Erro ao restaurar backup: ' + err.message);
      } finally {
        setRestaurando(false);
        if (backupInputRef.current) backupInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };
  const handleBaixarModelo = () => {
    // Ordem e nomes exatos das 16 colunas padrão do arquivo 8132
    const ws8132 = XLSX.utils.json_to_sheet([
      {
        'CODCLI': 14329,
        'CLIENTE': 'BAR DO NEI LTDA.',
        'MUNICENT': 'SALVADOR',
        'BAIRROENT': 'PITUBA',
        'ROTA ENTREGA': 'ROTA 10',
        'PLACA': 'OKT9410',
        'CARREGAMENTO': 5005413,
        'PEDIDO': 6049008707,
        'RCA': 'RAQUEL GOMES DOS SANTOS',
        'CÓD. DO PRODUTO': 4105,
        'PRODUTO': 'CUPIM GRILL CONG PLENA',
        'QUANTIDADE DE CAIXAS': 1,
        'PESO (KG)': 26.67,
        'N° NOTA FISCAL': 90374,
        'DATA SAÍDA': new Date().toLocaleDateString('pt-BR'),
        'VALOR PRODUTO': 1586.60
      }
    ], { 
      header: [
        'CODCLI', 
        'CLIENTE', 
        'MUNICENT', 
        'BAIRROENT', 
        'ROTA ENTREGA', 
        'PLACA', 
        'CARREGAMENTO', 
        'PEDIDO', 
        'RCA', 
        'CÓD. DO PRODUTO', 
        'PRODUTO', 
        'QUANTIDADE DE CAIXAS', 
        'PESO (KG)', 
        'N° NOTA FISCAL', 
        'DATA SAÍDA', 
        'VALOR PRODUTO'
      ] 
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws8132, "8132");
    XLSX.writeFile(wb, "Modelo_Importacao_8132.xlsx");
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setResult(null);
    }
  };

  const processFile = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      // Lê o workbook com suporte a todos os tipos de planilha Excel (.xls, .xlsx)
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
      
      let worksheet;
      // Procura a aba 8132 (onde estão os dados completos de itens/rotas)
      const aba8132 = workbook.SheetNames.find(name => name.includes('8132'));
      
      if (aba8132) {
        worksheet = workbook.Sheets[aba8132];
      } else {
        // Se não tiver o nome 8132, seleciona a aba com mais linhas
        let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
        let maxLen = 0;
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const rowsTemp = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (rowsTemp.length > maxLen) {
            maxLen = rowsTemp.length;
            bestSheet = ws;
          }
        }
        worksheet = bestSheet;
      }
      
      // Leitura em formato matricial (Array de Linhas)
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rawRows || rawRows.length < 2) {
        throw new Error("A planilha selecionada está vazia ou não possui linhas de dados.");
      }

      const headerRow = rawRows[0] || [];
      
      const normalizeStr = (s) => {
        return String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s]/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const headerMap = {};
      headerRow.forEach((h, idx) => {
        const normH = normalizeStr(h);
        if (normH) headerMap[normH] = idx;
      });

      const findColIdx = (possibleNames, fallbackIdx) => {
        // 1. Busca exata
        for (const name of possibleNames) {
          const normName = normalizeStr(name);
          for (const [hNorm, idx] of Object.entries(headerMap)) {
            if (hNorm === normName) return idx;
          }
        }
        // 2. Busca por termo contido
        for (const name of possibleNames) {
          const normName = normalizeStr(name);
          for (const [hNorm, idx] of Object.entries(headerMap)) {
            if (hNorm.includes(normName) || normName.includes(hNorm)) return idx;
          }
        }
        return fallbackIdx;
      };

      // Mapeamento dos índices das colunas
      const idxCodCli = findColIdx(['codcli', 'cod cliente', 'codigo cliente', 'cod_cliente', 'codcliente', 'cliente id'], 0);
      const idxCliente = findColIdx(['cliente', 'nome cliente', 'razao social', 'nome fantasia', 'destinatario'], 1);
      const idxCidade = findColIdx(['municent', 'municipio', 'cidade', 'cidade entrega', 'municipio entrega'], 2);
      const idxBairro = findColIdx(['bairroent', 'bairro', 'bairro entrega'], 3);
      const idxRota = findColIdx(['rota entrega', 'rota', 'setor', 'rota de entrega'], 4);
      const idxPlaca = findColIdx(['placa', 'veiculo', 'placa veiculo', 'cavalo'], 5);
      const idxCarga = findColIdx(['carregamento', 'carga', 'num carga', 'numero carga', 'romaneio', 'viagem'], 6);
      const idxPedido = findColIdx(['pedido', 'num pedido', 'numero pedido', 'ped'], 7);
      const idxRca = findColIdx(['rca', 'vendedor', 'representante', 'nome vendedor', 'consultor'], 8);
      const idxCodProd = findColIdx(['cod do produto', 'cod produto', 'codigo produto', 'cod prod', 'codigo item'], 9);
      const idxProd = findColIdx(['produto', 'desc produto', 'descricao produto', 'descricao', 'item'], 10);
      const idxQtd = findColIdx(['quantidade de caixas', 'qtd caixas', 'qtd de caixas', 'qtd', 'quantidade', 'volumes', 'caixas'], 11);
      const idxPeso = findColIdx(['peso kg', 'peso', 'peso liquido', 'peso bruto', 'kg'], 12);
      const idxNota = findColIdx(['n nota fiscal', 'n nota', 'nota fiscal', 'nf', 'nota', 'documento'], 13);
      const idxData = findColIdx(['data saida', 'data de entrega', 'data', 'data entrega', 'dt entrega', 'dt saida', 'emissao'], 14);
      const idxValor = findColIdx(['valor produto', 'valor', 'vlr produto', 'vlr total', 'total', 'preco'], 15);

      const cleanVal = (val) => {
        if (val === undefined || val === null) return '';
        if (typeof val === 'number') {
          if (Number.isInteger(val)) return String(val);
          return String(val);
        }
        return String(val).trim();
      };

      // Agrupamento por Nota Fiscal (1:N)
      const groupedData = {};

      for (let r = 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const rawNota = row[idxNota];
        let strNota = cleanVal(rawNota);

        // Se a coluna mapeada não tiver nota válida, tenta buscar em outras colunas numéricas
        if (!strNota || strNota === '0' || strNota.toLowerCase().startsWith('col_')) {
          continue;
        }

        if (!groupedData[strNota]) {
          const rawData = row[idxData];
          let strData = new Date().toISOString().split('T')[0];

          if (rawData) {
            if (typeof rawData === 'number' && rawData > 20000) {
              const utc_days = Math.floor(rawData - 25569);
              const d = new Date(utc_days * 864e5);
              const year = d.getUTCFullYear();
              const month = String(d.getUTCMonth() + 1).padStart(2, '0');
              const day = String(d.getUTCDate()).padStart(2, '0');
              strData = `${year}-${month}-${day}`;
            } else if (rawData instanceof Date && !isNaN(rawData)) {
              const year = rawData.getFullYear();
              const month = String(rawData.getMonth() + 1).padStart(2, '0');
              const day = String(rawData.getDate()).padStart(2, '0');
              strData = `${year}-${month}-${day}`;
            } else if (typeof rawData === 'string') {
              const cleaned = rawData.trim();
              if (cleaned.includes('/')) {
                const parts = cleaned.split('/');
                if (parts.length === 3) {
                  const day = parts[0].padStart(2, '0');
                  const month = parts[1].padStart(2, '0');
                  let year = parts[2];
                  if (year.length === 2) year = `20${year}`;
                  strData = `${year}-${month}-${day}`;
                }
              } else if (cleaned.includes('-')) {
                strData = cleaned;
              }
            }
          }

          groupedData[strNota] = {
            nota: strNota,
            pedido: cleanVal(row[idxPedido]),
            codCliente: cleanVal(row[idxCodCli]),
            cliente: cleanVal(row[idxCliente]) || 'CLIENTE NÃO IDENTIFICADO',
            cidade: cleanVal(row[idxCidade]),
            bairro: cleanVal(row[idxBairro]),
            rota: cleanVal(row[idxRota]),
            placa: cleanVal(row[idxPlaca]).toUpperCase(),
            carga: cleanVal(row[idxCarga]),
            data: strData,
            rca: cleanVal(row[idxRca]),
            peso: 0,
            valor: 0,
            itens: []
          };
        }

        const codigoItem = cleanVal(row[idxCodProd]);
        const descItem = cleanVal(row[idxProd]);
        
        const rawQtd = row[idxQtd];
        const qtdItem = typeof rawQtd === 'number' ? rawQtd : (parseFloat(String(rawQtd).replace(',', '.')) || 1);
        
        const rawPeso = row[idxPeso];
        const pesoItem = typeof rawPeso === 'number' ? rawPeso : (parseFloat(String(rawPeso).replace(',', '.')) || 0);

        const rawValor = row[idxValor];
        const valorItem = typeof rawValor === 'number' ? rawValor : (parseFloat(String(rawValor).replace(/[^\d.,]/g, '').replace(',', '.')) || 0);

        if (descItem && descItem !== '') {
          groupedData[strNota].itens.push({
            codigo: codigoItem,
            descricao: descItem,
            qtd: qtdItem,
            peso: pesoItem,
            valor: valorItem
          });
          groupedData[strNota].peso = Number((groupedData[strNota].peso + pesoItem).toFixed(2));
          groupedData[strNota].valor = Number((groupedData[strNota].valor + valorItem).toFixed(2));
        }
      }

      const novasEntregas = Object.values(groupedData);

      if (novasEntregas.length === 0) {
        throw new Error("Nenhuma nota fiscal válida encontrada na planilha. Verifique se o arquivo possui a estrutura correta.");
      }

      // Calcular estatísticas
      let novasCount = 0;
      let atualizadasCount = 0;
      
      novasEntregas.forEach(nova => {
        if (entregas.some(e => e.nota === nova.nota)) {
          atualizadasCount++;
        } else {
          novasCount++;
        }
      });

      // Disparar ação de gravação no Firestore via Zustand
      await importarEntregas(novasEntregas);

      setResult({ 
        novas: novasCount, 
        atualizadas: atualizadasCount, 
        total: novasEntregas.length 
      });
      setFile(null); // Limpar arquivo selecionado
      
    } catch (err) {
      console.error(err);
      alert(err.message || "Erro ao processar arquivo. Verifique se é uma planilha Excel válida.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Importação de Dados</h2>
        <p className="text-sm text-text-secondary mt-1">
          Faça upload da planilha oficial de rotas para abastecer o sistema. Notas já existentes serão apenas atualizadas (mantendo os status intactos).
        </p>
      </div>

      <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-border-secondary text-center hover:border-info transition-colors relative overflow-hidden group">
        <input 
          type="file" 
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        
        <div className="bg-background-secondary p-4 rounded-full mb-4 group-hover:bg-info/10 transition-colors">
          <UploadCloud className="text-info w-8 h-8" />
        </div>
        
        <h3 className="text-lg font-bold text-text-primary mb-2">Arraste a planilha para cá</h3>
        <p className="text-sm text-text-secondary max-w-sm mb-4">
          Suporta arquivos .xlsx e .xls gerados pelo seu sistema ERP.
        </p>

        <button 
          onClick={(e) => { e.stopPropagation(); handleBaixarModelo(); }}
          className="text-info hover:text-info/80 text-sm font-bold flex items-center gap-1 mb-6 transition-colors z-20 relative"
        >
          <DownloadCloud size={16} /> Baixar Planilha Modelo
        </button>

        {file ? (
          <div className="flex items-center gap-3 bg-background-primary px-4 py-3 rounded-xl border border-border-secondary shadow-sm relative z-20">
            <FileType className="text-success w-6 h-6" />
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-text-tertiary">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        ) : (
          <button className="bg-background-primary border border-border-secondary px-6 py-2 rounded-xl text-sm font-semibold text-text-primary shadow-sm relative z-0 pointer-events-none group-hover:border-info group-hover:text-info transition-colors">
            Selecionar Arquivo
          </button>
        )}
      </div>

      {file && (
        <div className="flex justify-end">
          <button 
            onClick={processFile}
            disabled={loading}
            className="bg-info hover:bg-info/90 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processando...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Importar Planilha</>
            )}
          </button>
        </div>
      )}

      {result && (
        <div className="bg-success/10 border border-success/20 p-6 rounded-2xl flex items-start gap-4 animate-fade-in">
          <CheckCircle2 className="text-success w-8 h-8 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-success text-lg mb-1">Importação Concluída com Sucesso!</h3>
            <p className="text-sm text-success/80 mb-4">A base de dados foi atualizada sem afetar o andamento da operação.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/10">
                <p className="text-xs text-success/70 font-semibold uppercase tracking-wider mb-1">Novas Notas Inseridas</p>
                <p className="text-2xl font-black text-success">{result.novas}</p>
              </div>
              <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-success/10">
                <p className="text-xs text-success/70 font-semibold uppercase tracking-wider mb-1">Notas Atualizadas</p>
                <p className="text-2xl font-black text-success">{result.atualizadas}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-background-secondary p-5 rounded-2xl border border-border-secondary flex items-start gap-3 mt-8">
        <AlertCircle className="text-warning w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary">
          <p className="font-bold text-text-primary mb-1">Regras de Leitura Inteligente</p>
          <ul className="list-disc pl-4 space-y-1 mt-2">
            <li>O sistema identifica as notas pela coluna <strong>NF</strong> ou <strong>Nota Fiscal</strong>.</li>
            <li>Se uma nota já existir no sistema e seu motorista já estiver a caminho (status diferente de "Pendente"), <strong>o status dela será preservado</strong>.</li>
            <li>Qualquer devolução atrelada à nota existente também será preservada intacta.</li>
            <li>Você pode subir a planilha várias vezes ao dia conforme novas notas são faturadas no ERP sem medo de duplicidade.</li>
          </ul>
        </div>
      </div>

      {/* Danger Zone: Arquivos/Datas Importadas */}
      <div className="mt-8 border border-border-secondary rounded-2xl overflow-hidden glass-panel">
        <div className="bg-background-secondary p-5 border-b border-border-secondary">
          <h3 className="font-bold text-danger flex items-center gap-2"><Trash2 size={20} /> Histórico de Importações</h3>
          <p className="text-sm text-text-secondary mt-1">
            Abaixo estão listados os dias que possuem notas no banco de dados. Excluir uma data apagará <strong>todas</strong> as notas daquele dia permanentemente.
          </p>
        </div>
        
        <div className="divide-y divide-border-tertiary">
          {datasImportadas.length === 0 ? (
            <div className="p-6 text-center text-text-tertiary text-sm font-medium">Nenhum dado importado no sistema.</div>
          ) : (
            datasImportadas.map(({ data, count }) => (
              <div key={data} className="p-4 sm:px-6 hover:bg-background-secondary/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-text-primary text-base">
                      {new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                    <p className="text-xs text-text-secondary font-medium">
                      {count} {count === 1 ? 'nota fiscal' : 'notas fiscais'}
                    </p>
                  </div>
                  
                  {dataParaExcluir === data ? (
                    <div className="flex flex-col items-end gap-2 bg-danger/5 p-3 rounded-xl border border-danger/20 w-full sm:w-auto animate-fade-in">
                      <div className="flex gap-2 w-full">
                        <input 
                          type="password"
                          placeholder="Senha Monitoramento"
                          value={senhaExclusao}
                          onChange={e => { setSenhaExclusao(e.target.value); setErroSenha(''); }}
                          className="bg-background-primary border border-danger/30 rounded-lg px-3 py-1.5 text-sm w-full sm:w-48 focus:ring-1 focus:ring-danger"
                          autoFocus
                        />
                        <button 
                          onClick={handleExcluirData}
                          className="bg-danger text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-danger/90 whitespace-nowrap"
                        >
                          Confirmar
                        </button>
                      </div>
                      {erroSenha && <span className="text-xs text-danger font-bold">{erroSenha}</span>}
                      <button 
                        onClick={() => { setDataParaExcluir(null); setSenhaExclusao(''); setErroSenha(''); }}
                        className="text-xs text-text-secondary hover:text-text-primary font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setDataParaExcluir(data); setSenhaExclusao(''); setErroSenha(''); }}
                      className="text-danger hover:bg-danger/10 border border-danger/20 px-4 py-2 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                    >
                      Excluir Arquivo
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Seção de Backup do Sistema */}
      <div className="mt-8 border border-border-secondary rounded-2xl overflow-hidden glass-panel">
        <div className="bg-background-secondary p-5 border-b border-border-secondary">
          <h3 className="font-bold text-text-primary flex items-center gap-2"><Database size={20} className="text-info" /> Backup do Sistema</h3>
          <p className="text-sm text-text-secondary mt-1">
            Faça uma cópia de segurança local de todo o banco de dados atual ou restaure um backup antigo. A restauração não apaga os dados existentes, apenas mescla as informações do arquivo com a nuvem.
          </p>
        </div>
        <div className="p-5 flex flex-col sm:flex-row gap-4 items-center">
          <button 
            onClick={handleExportarBackup}
            className="w-full sm:w-auto bg-background-secondary hover:bg-border-tertiary text-text-primary border border-border-secondary px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <DownloadCloud size={18} /> Baixar Backup (.json)
          </button>
          
          <div className="w-full sm:w-auto relative group">
            <input 
              type="file" 
              accept=".json"
              ref={backupInputRef}
              onChange={handleImportarBackup}
              disabled={restaurando}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <button 
              disabled={restaurando}
              className="w-full bg-info hover:bg-info/90 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {restaurando ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {restaurando ? 'Restaurando...' : 'Restaurar Backup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
