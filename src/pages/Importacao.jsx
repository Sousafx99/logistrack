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
    // Ordem exata das colunas do arquivo "Arquivo padrao do monitoramento.xlsx"
    const ws8132 = XLSX.utils.json_to_sheet([
      {
        'Cod cliente': '123',
        'CLIENTE': 'SUPERMERCADO EXEMPLO LTDA',
        'CIDADE': 'RIO DE JANEIRO',
        'BAIRRO': 'CENTRO',
        'ROTA': 'RJ-01',
        'PLACA': 'ABC1D23',
        'CARREGAMENTO': '1001',
        'PEDIDO': '98765',
        'VENDEDOR': 'VENDEDOR JOAO',
        'COD PRODUTO': '789',
        'DESC PRODUTO': 'REFRIGERANTE COLA 2L',
        'QTD DE CAIXAS': 10,
        'PESO': 20.5,
        'NF': '123456',
        'DATA SAÍDA': '15/06/2026',
        'VALOR PRODUTO': 150.00
      }
    ], { header: ['Cod cliente', 'CLIENTE', 'CIDADE', 'BAIRRO', 'ROTA', 'PLACA', 'CARREGAMENTO', 'PEDIDO', 'VENDEDOR', 'COD PRODUTO', 'DESC PRODUTO', 'QTD DE CAIXAS', 'PESO', 'NF', 'DATA SAÍDA', 'VALOR PRODUTO'] });

    const ws1452 = XLSX.utils.json_to_sheet([]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1452, "1452");
    XLSX.utils.book_append_sheet(wb, ws8132, "8132");
    
    XLSX.writeFile(wb, "Arquivo_padrao_do_monitoramento.xlsx");
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
      const workbook = XLSX.read(data, { type: 'array' });
      
      let worksheet;
      // Procura a aba 8132 (onde estão os dados completos de itens/rotas)
      const aba8132 = workbook.SheetNames.find(name => name.includes('8132'));
      
      if (aba8132) {
        worksheet = workbook.Sheets[aba8132];
      } else {
        // Se não tiver o nome 8132, tenta achar a aba que contenha a coluna PLACA ou BAIRRO
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const jsonTemp = XLSX.utils.sheet_to_json(ws, { defval: '' });
          if (jsonTemp.length > 0) {
            const keysStr = Object.keys(jsonTemp[0]).join(' ').toLowerCase();
            if (keysStr.includes('placa') || keysStr.includes('carregamento') || keysStr.includes('bairro')) {
              worksheet = ws;
              break;
            }
          }
        }
        if (!worksheet) worksheet = workbook.Sheets[workbook.SheetNames[0]]; // fallback
      }
      
      // Converte para JSON a aba correta selecionada
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      // Agrupar por Nota
      const groupedData = {};

      jsonData.forEach(row => {
        // Tentar encontrar as colunas independentemente de maiúsculas/minúsculas
        const getVal = (possibleKeys) => {
          for (let key of Object.keys(row)) {
            if (possibleKeys.includes(key.toLowerCase().trim())) return row[key];
          }
          return '';
        };

        const nota = getVal(['nf', 'nota', 'nota fiscal', 'n.f']);
        if (!nota) return; // Se não tem nota, ignora a linha

        const strNota = String(nota).trim();
        
        if (!groupedData[strNota]) {
          // Lida com datas vindas do excel (número serial) ou string
          let dataVal = getVal(['data saída', 'data saida', 'data', 'data entrega', 'dt_entrega']);
          let strData = new Date().toISOString().split('T')[0]; // fallback hoje
          
          if (typeof dataVal === 'number') {
             // Excel date serial para YYYY-MM-DD
             const d = new Date(Math.round((dataVal - 25569) * 864e5));
             strData = d.toISOString().split('T')[0];
          } else if (typeof dataVal === 'string' && dataVal.includes('/')) {
             const parts = dataVal.split('/');
             if (parts.length === 3) strData = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else if (dataVal) {
             strData = String(dataVal);
          }

          // Inicializa a entrega
          groupedData[strNota] = {
            nota: strNota,
            pedido: String(getVal(['pedido', 'num pedido'])),
            codCliente: String(getVal(['codcli', 'cod cliente', 'cod', 'codcliente', 'cliente_id'])),
            cliente: String(getVal(['cliente', 'nome cliente', 'razao social'])),
            cidade: String(getVal(['cidade', 'municipio'])),
            bairro: String(getVal(['bairro'])),
            rota: String(getVal(['rota'])),
            placa: String(getVal(['placa', 'veiculo'])),
            carga: String(getVal(['carregamento', 'carga', 'num carga'])),
            data: strData, 
            rca: String(getVal(['vendedor', 'rca', 'representante'])),
            peso: 0, // será calculado
            itens: []
          };
        }

        // Extrai o item dessa linha
        const codigoItem = String(getVal(['cod produto', 'codigo', 'cod item', 'produto']));
        const descItem = String(getVal(['desc produto', 'descricao', 'desc', 'produto desc', 'descricao produto']));
        const qtdItem = Number(getVal(['qtd de caixas', 'qtd', 'quantidade', 'qtde'])) || 1;
        const pesoItem = Number(getVal(['peso', 'peso kg', 'kg'])) || 0;

        if (descItem && descItem.trim() !== '') {
          groupedData[strNota].itens.push({
            codigo: codigoItem,
            descricao: descItem,
            qtd: qtdItem,
            peso: pesoItem
          });
          groupedData[strNota].peso += pesoItem;
        }
      });

      const novasEntregas = Object.values(groupedData);

      if (novasEntregas.length === 0) {
        throw new Error("Nenhuma nota fiscal encontrada. Verifique os cabeçalhos da planilha.");
      }

      // Calcular estatísticas simulando o que o useStore fará
      let novasCount = 0;
      let atualizadasCount = 0;
      
      novasEntregas.forEach(nova => {
        if (entregas.some(e => e.nota === nova.nota)) {
          atualizadasCount++;
        } else {
          novasCount++;
        }
      });

      // Disparar ação no Zustand
      importarEntregas(novasEntregas);

      setResult({ novas: novasCount, atualizadas: atualizadasCount, total: novasEntregas.length });
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
