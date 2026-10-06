import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AbaClientes } from '../components/cadastros/AbaClientes';
import { AbaVeiculos } from '../components/cadastros/AbaVeiculos';
import { AbaMotoristas } from '../components/cadastros/AbaMotoristas';
import { AbaGeolocalizacao } from '../components/cadastros/AbaGeolocalizacao';
import { AbaFuncionarios } from '../components/cadastros/AbaFuncionarios';

export function Cadastros() {
  const [searchParams] = useSearchParams();
  const abaParam = searchParams.get('aba') || 'clientes';
  
  // Normalizar aba ativa ('solicitacoes' e 'gps' mapeiam para 'geolocalizacao', 'funcionarios' mapeia para 'colaboradores')
  const abaAtiva = useMemo(() => {
    if (abaParam === 'solicitacoes' || abaParam === 'gps') return 'geolocalizacao';
    if (abaParam === 'funcionarios') return 'colaboradores';
    if (['clientes', 'veiculos', 'motoristas', 'geolocalizacao', 'colaboradores'].includes(abaParam)) {
      return abaParam;
    }
    return 'clientes';
  }, [abaParam]);

  return (
    <div className="w-full pb-20">
      {abaAtiva === 'clientes' && <AbaClientes />}
      {abaAtiva === 'veiculos' && <AbaVeiculos />}
      {abaAtiva === 'motoristas' && <AbaMotoristas />}
      {abaAtiva === 'geolocalizacao' && <AbaGeolocalizacao />}
      {abaAtiva === 'colaboradores' && <AbaFuncionarios />}
    </div>
  );
}

export default Cadastros;
