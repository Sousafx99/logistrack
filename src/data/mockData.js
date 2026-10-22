export const STATUS_OPTIONS = [
  'Pendente',
  'No cliente',
  'Descarregando',
  'Entrega total',
  'Entrega parcial',
  'Devolução total',
  'Carga parada',
  'Reentrega'
];

export const STATUS_DEVOLUCAO_GERAL = [
  'Pendente de recebimento',
  'Recebido na operação'
];

export const STATUS_DEVOLUCAO_MONITORAMENTO = [
  'Confirmado pelo motorista',
  'Devolução lançada'
];

export const TRATAMENTO_MERCADORIA = [
  'Aguardando definição',
  'Devolver ao estoque',
  'Reentrega',
  'Manter bloqueada (Segregada)',
  'Abatimento / Quebra de Gramatura (Sem retorno físico)'
];

// Lista simplificada e direta para os Motoristas (sem prefixos de setor)
export const MOTIVOS_DEVOLUCAO_MOTORISTA = [
  'Preço, quantidade ou Produto incorreto',
  'Má qualidade / mau cheiro / avaria / vencido',
  'Falta de peso / Dev. gramatura',
  'Problema com pagamento / cartão',
  'Sem pedido / Desistiu / Pedido duplicado',
  'Endereço errado / não localizado',
  'Fora de horário / cliente fechado / sem condição',
  'Veículo quebrado / problema no transporte'
];

export const MOTIVOS_DEVOLUCAO = [
  '5 - COMERCIAL - CLIENTE NAO FEZ O PEDIDO',
  '6 - COMERCIAL - PEDIDO EM DUPLICIDADE',
  '10 - COMERCIAL - PRECO EM DESACORDO',
  '14 - COMERCIAL - QUANTIDADE EM DESACORDO',
  '15 - COMERCIAL - PRODUTO EM DESACORDO',
  '16 - COMERCIAL - ENDERECO INCORRETO',
  '17 - OPERACIONAL - FALTA DE PESO GRAMATURA CAIXA',
  '18 - SISTEMA - PESO MEDIO DIVERGENTE',
  '20 - OP ARMAZEM - PRODUTO NÃO CARREGADO',
  '21 - OP ARMAZEM - PRODUTO TROCADO',
  '22 - OP ARMAZEM - VALIDADE PROXIMA DE VENCIMENTO',
  '23 - OP ARMAZEM - FALTA DE PESO',
  '24 - OP TRANSPORTADORA - PRODUTO TROCADO',
  '25 - OP TRANSPORTADORA - TEMPERATURA FORA DO PADRAO',
  '26 - OP TRANSPORTADORA - CAIXA AVARIADA',
  '27 - OP TRANSPORTADORA - ENTREGA NÃO REALIZADA',
  '33 - OP TRANSPORTADORA - ENTREGA NO ESTABELECIMENTO ERRADO',
  '43 - OP FORNECEDOR - PRODUTO INVERSAO INTERNA',
  '46 - OPERACIONAL - FORA DO HORARIO DE RECEBIMENTO',
  '51 - COMERCIAL - CLIENTE SEM CONDICAO DE RECEBIMENTO',
  '56 - QUALIDADE - PRODUTO FORA DO PADRAO COR',
  '58 - QUALIDADE - PRODUTO FORA DO PADRAO ODOR',
  '61 - QUALIDADE - PRODUTO FORA DO PADRAO ASPECTO',
  '62 - QUALIDADE - PRODUTO IMPROPRIO PARA CONSUMO',
  '84 - QUALIDADE - PRODUTO SEM VACUO',
  '88 - QUALIDADE - FALTA DE PESO',
  '89 - FISCAL - TRIBUTACAO INCORRETA',
  '91 - TI-PROBLEMA NO SISTEMA',
  '94 - TRA-FALTA NA ENTREGA',
  '96 - REAVALIADO PELA DIRETORIA',
  '97 - TEMPO EXCEDIDO NO CLIENTE',
  '98 - CLIENTE - DEVOLUCAO CARTAO CREDITO',
  '99 - TRANSPORTADORA - TEMPERATURA FORA DO PADRÃO',
  '100 - ARMAZEM - TEMPERATURA FORA DO PADRAO',
  '101 - TRANSPORTADORA - ERRO NA ENTREGA',
  '102 - ARMAZEM - PRODUTO TROCADO',
  '103 - TRANSPORTADORA - VEICULO QUEBRADO',
  '104 - ARMAZEM - ATRASO NO CARREGAMENTO',
  '105 - COMERCIAL - CLIENTE DESISTIU DA COMPRA',
  '106 - RECOLHIMENTO - PRODUTO INVERTIDO',
  '107 - RECOLHIMENTO - PRODUTO FORA DO PADRAO'
];

export const mockEntregas = [];
export const mockDevolucoes = [];

// Helper para padronizar e destacar o Tipo de Devolução / Ocorrência
export const getTipoDevolucaoBadge = (tipo) => {
  const t = String(tipo || 'Total').trim();
  if (t === 'Total' || t === 'Devolução total' || t.toLowerCase() === 'total' || t.toLowerCase() === 'devolução total') {
    return {
      label: 'Devolução Total',
      badgeClass: 'bg-rose-500/10 text-rose-500 border border-rose-500/30 font-bold',
      borderClass: 'border-l-rose-500',
      pillClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30 font-bold',
      tagText: 'Total',
      semRetornoFisico: false
    };
  }
  if (t === 'Devolução de gramatura' || t === 'Gramatura' || t.toLowerCase().includes('gramatura')) {
    return {
      label: 'Dev. Gramatura (Sem Retorno)',
      badgeClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold',
      borderClass: 'border-l-amber-500',
      pillClass: 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold',
      tagText: 'Gramatura (Sem Retorno)',
      semRetornoFisico: true
    };
  }
  if (t === 'Parcial' || t === 'Entrega parcial' || t.toLowerCase() === 'parcial' || t.toLowerCase() === 'entrega parcial' || t.includes('parcial')) {
    return {
      label: 'Entrega Parcial (Com Retorno)',
      badgeClass: 'bg-blue-500/10 text-blue-500 border border-blue-500/30 font-bold',
      borderClass: 'border-l-blue-500',
      pillClass: 'bg-blue-500/10 text-blue-500 border-blue-500/30 font-bold',
      tagText: 'Parcial (Com Retorno)',
      semRetornoFisico: false
    };
  }
  if (t === 'Reentrega' || t.toLowerCase() === 'reentrega') {
    return {
      label: 'Reentrega',
      badgeClass: 'bg-purple-500/10 text-purple-500 border border-purple-500/30 font-bold',
      borderClass: 'border-l-purple-500',
      pillClass: 'bg-purple-500/10 text-purple-500 border-purple-500/30 font-bold',
      tagText: 'Reentrega',
      semRetornoFisico: false
    };
  }
  return {
    label: t,
    badgeClass: 'bg-rose-500/10 text-rose-500 border border-rose-500/30 font-bold',
    borderClass: 'border-l-rose-500',
    pillClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30 font-bold',
    tagText: t,
    semRetornoFisico: false
  };
};
