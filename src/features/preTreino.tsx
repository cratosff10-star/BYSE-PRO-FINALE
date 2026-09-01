// @ts-nocheck
import React, { useState } from 'react';
import { Users, Calendar, DollarSign, Clock, Search, Plus, CheckCircle, AlertCircle, Package, Award, X, TrendingUp, AlertTriangle, Filter, Trash2 } from 'lucide-react';

export function PreTreino({ 
  card, border, subtext, accent, text, dark, 
  clientes, setClientes, 
  produtosPreTreino, setProdutosPreTreino, 
  registros, setRegistros,
  API_URL, getAuthHeaders
}: any) {
  const [activeSubTab, setActiveSubTab] = useState<'preTreino' | 'clientes' | 'produtos' | 'relatorios'>('preTreino');
  
  const [novoNomeCliente, setNovoNomeCliente] = useState('');
  const [novoTelefoneCliente, setNovoTelefoneCliente] = useState('');
  const [novoValorMensalidade, setNovoValorMensalidade] = useState('90.00');
  
  const obterDataUmMesAdiantado = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const [novoVencimentoCliente, setNovoVencimentoCliente] = useState(obterDataUmMesAdiantado());
  const [clienteSelecionadoDetalhes, setClienteSelecionadoDetalhes] = useState<any>(null);
  const [filtroClientes, setFiltroClientes] = useState<'todos' | 'ativos' | 'naoPagos' | 'aVencer' | 'inativos'>('todos');

  const [novoNomeProduto, setNovoNomeProduto] = useState('');
  const [novoCustoProduto, setNovoCustoProduto] = useState('');

  const [tipoConsumo, setTipoConsumo] = useState<'cadastrado' | 'avulso'>('cadastrado');
  const [novoClienteId, setNovoClienteId] = useState('');
  const [nomeClienteAvulso, setNomeClienteAvulso] = useState('');
  const [novoProdutoId, setNewProdutoId] = useState('');
  const [erroConsumo, setErroConsumo] = useState('');

  const cardBg = card;
  const borderColor = border;

  const verificarVencimento = (dataVencimentoStr: string) => {
    if (!dataVencimentoStr) return { texto: 'Data não informada', alerta: false, dias: 999 };
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const vencimento = new Date(dataVencimentoStr + 'T00:00:00');
    const diferencaTempo = vencimento.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(diferencaTempo / (1000 * 3600 * 24));

    if (diasRestantes < 0) {
      return { texto: `Vencido há ${Math.abs(diasRestantes)} dia(s)`, alerta: true, dias: diasRestantes };
    } else if (diasRestantes === 0) {
      return { texto: 'Vence hoje!', alerta: true, dias: 0 };
    } else if (diasRestantes <= 4) {
      return { texto: `Faltam ${diasRestantes} dia(s) para vencer`, alerta: true, dias: diasRestantes };
    } else {
      return { texto: `Vence em ${diasRestantes} dias`, alerta: false, dias: diasRestantes };
    }
  };

  const clientesParaConsumo = (clientes || []).filter(c => c.statusMensalidade === 'Pago');
  const clientesValidosCusto = (clientes || []).filter(c => c.statusMensalidade !== 'Inativo');
  const totalCustoPreTreinosMes = (registros || []).reduce((acc, curr) => acc + (curr.custo || 0), 0);
  const totalValorMensalidades = clientesValidosCusto.reduce((acc, curr) => acc + Number(curr.valorMensalidade || 0), 0); 
  const custoGeralTotalMes = totalCustoPreTreinosMes + totalValorMensalidades;

  const clientesFiltrados = (clientes || []).filter(c => {
    const infoVenc = verificarVencimento(c.dataVencimento);
    if (filtroClientes === 'ativos') return c.statusMensalidade === 'Pago';
    if (filtroClientes === 'naoPagos') return c.statusMensalidade?.includes('Pendente') || c.statusMensalidade?.includes('Não Pago');
    if (filtroClientes === 'aVencer') return infoVenc.dias >= 0 && infoVenc.dias <= 4 && c.statusMensalidade !== 'Pago';
    if (filtroClientes === 'inativos') return c.statusMensalidade === 'Inativo';
    return true;
  });

  const handleCadastrarCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNomeCliente || !novoTelefoneCliente) return;

    const novo = {
      id: `cli_pre_${Date.now()}`,
      name: novoNomeCliente,
      nome: novoNomeCliente,
      telefone: novoTelefoneCliente,
      phone: novoTelefoneCliente,
      statusMensalidade: 'Pendente (Não Pago)',
      dataVencimento: novoVencimentoCliente || obterDataUmMesAdiantado(),
      valorMensalidade: Number(novoValorMensalidade) || 0
    };

    const atualizados = [...(clientes || []), novo];
    setClientes(atualizados);
    setNovoNomeCliente('');
    setNovoTelefoneCliente('');
    setNovoValorMensalidade('90.00');
    setNovoVencimentoCliente(obterDataUmMesAdiantado());
  };

  const handleAtualizarStatusCliente = async (clienteId: string, novoStatus: string) => {
    try {
      const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
      if (API_URL) {
        const response = await fetch(`${API_URL}/customers/${clienteId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ status_mensalidade: novoStatus })
        });

        if (!response.ok) {
          alert("Erro ao atualizar status no servidor. Tente novamente.");
          return;
        }
      }

      const atualizados = (clientes || []).map(c => {
        if (c.id === clienteId) {
          return { ...c, statusMensalidade: novoStatus };
        }
        return c;
      });
      setClientes(atualizados);
      
      if (clienteSelecionadoDetalhes && clienteSelecionadoDetalhes.id === clienteId) {
        setClienteSelecionadoDetalhes({ ...clienteSelecionadoDetalhes, statusMensalidade: novoStatus });
      }
    } catch (error) {
      console.error("Erro ao persistir a atualização de status:", error);
      alert("Erro de conexão ao atualizar o status do cliente.");
    }
  };

  const handleExcluirCliente = async (clienteId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
      if (API_URL) {
        const response = await fetch(`${API_URL}/customers/${clienteId}`, {
          method: 'DELETE',
          headers
        });

        if (!response.ok) {
          alert("Erro ao excluir cliente no servidor.");
          return;
        }
      }

      const filtrados = (clientes || []).filter(c => c.id !== clienteId);
      setClientes(filtrados);
      setClienteSelecionadoDetalhes(null);
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      alert("Erro de conexão ao excluir o cliente.");
    }
  };

  const handleCadastrarProduto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNomeProduto || !novoCustoProduto) return;

    const novoProd = {
      id: `prod_pre_${Date.now()}`,
      name: novoNomeProduto,
      nome: novoNomeProduto,
      price: Number(novoCustoProduto),
      custo: Number(novoCustoProduto)
    };

    const atualizados = [...(produtosPreTreino || []), novoProd];
    setProdutosPreTreino(atualizados);
    setNovoNomeProduto('');
    setNovoCustoProduto('');
  };

  const handleExcluirProduto = async (produtoId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este produto de pré-treino?')) return;
    try {
      const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
      if (API_URL) {
        const response = await fetch(`${API_URL}/products/${produtoId}`, {
          method: 'DELETE',
          headers
        });

        if (!response.ok) {
          alert("Erro ao excluir produto no servidor.");
          return;
        }
      }

      const filtrados = (produtosPreTreino || []).filter(p => p.id !== produtoId);
      setProdutosPreTreino(filtrados);
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      alert("Erro de conexão ao excluir o produto.");
    }
  };

  const handleRegistrarPreTreino = (e: React.FormEvent) => {
    e.preventDefault();
    setErroConsumo('');
    if (!novoProdutoId) return;

    let idClienteFinal = '';
    let nomeClienteFinal = '';

    if (tipoConsumo === 'cadastrado') {
      if (!novoClienteId) return;
      const clienteSelecionado = (clientes || []).find(c => c.id === novoClienteId);
      if (!clienteSelecionado) return;

      if (clienteSelecionado.statusMensalidade !== 'Pago') {
        setErroConsumo(`Não é possível lançar o pré-treino. O cliente ${clienteSelecionado.nome || clienteSelecionado.name} precisa estar com a mensalidade "Paga".`);
        return;
      }
      idClienteFinal = clienteSelecionado.id;
      nomeClienteFinal = clienteSelecionado.nome || clienteSelecionado.name;
    } else {
      if (!nomeClienteAvulso.trim()) {
        setErroConsumo('Por favor, informe o nome do cliente avulso.');
        return;
      }
      idClienteFinal = 'avulso_' + Date.now();
      nomeClienteFinal = `${nomeClienteAvulso.trim()} (Avulso)`;
    }

    const produtoSelecionado = (produtosPreTreino || []).find(p => p.id === novoProdutoId);
    if (!produtoSelecionado) return;

    const agora = new Date();
    const novoRegistro = {
      id: `reg_${Date.now()}`,
      clienteId: idClienteFinal,
      nomeCliente: nomeClienteFinal,
      produtoId: produtoSelecionado.id,
      nomeProduto: produtoSelecionado.nome || produtoSelecionado.name,
      custo: Number(produtoSelecionado.custo || produtoSelecionado.price || 0),
      data: agora.toISOString().split('T')[0],
      horario: agora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const atualizados = [novoRegistro, ...(registros || [])];
    setRegistros(atualizados);
    setNovoClienteId('');
    setNomeClienteAvulso('');
    setNewProdutoId('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 'bold', margin: '0 0 6px 0', color: text }}>
          Gestão de Pré-Treino & Mensalidades
        </h1>
        <p style={{ color: subtext, fontSize: 13, margin: 0 }}>
          Painel financeiro de custos, controle de consumo na loja, vendas avulsas, cadastro de clientes e relatórios.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ backgroundColor: cardBg, padding: 18, borderRadius: 12, border: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: 12, color: subtext, marginBottom: 4 }}>Custo Total Pré-Treinos (Mês)</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: accent }}>R$ {totalCustoPreTreinosMes.toFixed(2)}</div>
        </div>
        <div style={{ backgroundColor: cardBg, padding: 18, borderRadius: 12, border: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: 12, color: subtext, marginBottom: 4 }}>Valor Total de Mensalidades</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: text }}>R$ {totalValorMensalidades.toFixed(2)}</div>
        </div>
        <div style={{ backgroundColor: cardBg, padding: 18, borderRadius: 12, border: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: 12, color: subtext, marginBottom: 4 }}>Custo Geral Consolidado</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: text }}>R$ {custoGeralTotalMes.toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${borderColor}`, paddingBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveSubTab('preTreino')}
          style={{ padding: '8px 16px', borderRadius: 8, border: activeSubTab === 'preTreino' ? `1px solid ${accent}` : `1px solid ${borderColor}`, backgroundColor: activeSubTab === 'preTreino' ? accent : cardBg, color: activeSubTab === 'preTreino' ? '#ffffff' : text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Consumo & Venda Avulsa
        </button>
        <button
          onClick={() => setActiveSubTab('clientes')}
          style={{ padding: '8px 16px', borderRadius: 8, border: activeSubTab === 'clientes' ? `1px solid ${accent}` : `1px solid ${borderColor}`, backgroundColor: activeSubTab === 'clientes' ? accent : cardBg, color: activeSubTab === 'clientes' ? '#ffffff' : text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Cadastrar Clientes
        </button>
        <button
          onClick={() => setActiveSubTab('produtos')}
          style={{ padding: '8px 16px', borderRadius: 8, border: activeSubTab === 'produtos' ? `1px solid ${accent}` : `1px solid ${borderColor}`, backgroundColor: activeSubTab === 'produtos' ? accent : cardBg, color: activeSubTab === 'produtos' ? '#ffffff' : text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Produtos de Pré-Treino
        </button>
        <button
          onClick={() => setActiveSubTab('relatorios')}
          style={{ padding: '8px 16px', borderRadius: 8, border: activeSubTab === 'relatorios' ? `1px solid ${accent}` : `1px solid ${borderColor}`, backgroundColor: activeSubTab === 'relatorios' ? accent : cardBg, color: activeSubTab === 'relatorios' ? '#ffffff' : text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Relatórios Anuais
        </button>
      </div>

      {activeSubTab === 'preTreino' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
            <div style={{ backgroundColor: cardBg, padding: 20, borderRadius: 12, border: `1px solid ${borderColor}` }}>
              <h2 style={{ fontSize: 16, color: text, marginBottom: 16 }}>Registrar Consumo / Venda</h2>
              
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <button type="button" onClick={() => setTipoConsumo('cadastrado')} style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 11, fontWeight: 'bold', cursor: 'pointer', border: tipoConsumo === 'cadastrado' ? `2px solid ${accent}` : `1px solid ${borderColor}`, backgroundColor: tipoConsumo === 'cadastrado' ? `${accent}22` : 'transparent', color: text }}>
                  👤 Cliente Cadastrado
                </button>
                <button type="button" onClick={() => setTipoConsumo('avulso')} style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 11, fontWeight: 'bold', cursor: 'pointer', border: tipoConsumo === 'avulso' ? `2px solid ${accent}` : `1px solid ${borderColor}`, backgroundColor: tipoConsumo === 'avulso' ? `${accent}22` : 'transparent', color: text }}>
                  ⚡ Venda Avulsa
                </button>
              </div>

              {erroConsumo && (
                <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: '#ef444422', border: '1px solid #ef4444', color: '#f87171', fontSize: 12 }}>
                  ⚠️ {erroConsumo}
                </div>
              )}

              <form onSubmit={handleRegistrarPreTreino} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {tipoConsumo === 'cadastrado' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Cliente (Apenas com Mensalidade Paga)</label>
                    <select value={novoClienteId} onChange={(e) => setNovoClienteId(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text }} required={tipoConsumo === 'cadastrado'}>
                      <option value="">Selecione o cliente em dia...</option>
                      {clientesParaConsumo.map(c => (
                        <option key={c.id} value={c.id}>{c.nome || c.name} ✅</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Nome do Cliente Avulso</label>
                    <input type="text" placeholder="Ex: Visitante / João (Avulso)" value={nomeClienteAvulso} onChange={(e) => setNomeClienteAvulso(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text, boxSizing: 'border-box' }} required={tipoConsumo === 'avulso'} />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Produto de Pré-Treino</label>
                  <select value={novoProdutoId} onChange={(e) => setNewProdutoId(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text }} required>
                    <option value="">Selecione o produto/dose...</option>
                    {produtosPreTreino.map(p => (
                      <option key={p.id} value={p.id}>{p.nome || p.name} (R$ {(p.custo || p.price || 0).toFixed(2)})</option>
                    ))}
                  </select>
                </div>

                <button type="submit" style={{ backgroundColor: accent, color: '#ffffff', padding: 10, border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                  Lançar Consumo / Venda
                </button>
              </form>
            </div>

            <div style={{ backgroundColor: cardBg, padding: 20, borderRadius: 12, border: `1px solid ${borderColor}` }}>
              <h2 style={{ fontSize: 16, color: text, marginBottom: 16 }}>Consumos & Vendas Recentes</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <th style={{ padding: 10, fontSize: 12, color: subtext }}>Consumidor</th>
                    <th style={{ padding: 10, fontSize: 12, color: subtext }}>Produto</th>
                    <th style={{ padding: 10, fontSize: 12, color: subtext }}>Custo</th>
                    <th style={{ padding: 10, fontSize: 12, color: subtext }}>Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {(registros || []).length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: 15, textAlign: 'center', fontSize: 12, color: subtext }}>Nenhum consumo registrado.</td></tr>
                  ) : (
                    (registros || []).map(r => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: 10, fontSize: 13, color: text, fontWeight: 'bold' }}>{r.nomeCliente}</td>
                        <td style={{ padding: 10, fontSize: 13, color: text }}>{r.nomeProduto}</td>
                        <td style={{ padding: 10, fontSize: 13, color: accent }}>R$ {(r.custo || 0).toFixed(2)}</td>
                        <td style={{ padding: 10, fontSize: 12, color: subtext }}>{r.data} às {r.horario}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'clientes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
          <div style={{ backgroundColor: cardBg, padding: 20, borderRadius: 12, border: `1px solid ${borderColor}` }}>
            <h2 style={{ fontSize: 16, color: text, marginBottom: 16 }}>Novo Cliente</h2>
            <form onSubmit={handleCadastrarCliente} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Nome Completo</label>
                <input type="text" placeholder="Ex: Carlos Silva" value={novoNomeCliente} onChange={(e) => setNovoNomeCliente(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text, boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Telefone / WhatsApp</label>
                <input type="text" placeholder="(83) 99999-9999" value={novoTelefoneCliente} onChange={(e) => setNovoTelefoneCliente(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text, boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Valor da Mensalidade (R$)</label>
                <input type="number" step="0.01" placeholder="90.00" value={novoValorMensalidade} onChange={(e) => setNovoValorMensalidade(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text, boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Data de Vencimento</label>
                <input type="date" value={novoVencimentoCliente} onChange={(e) => setNovoVencimentoCliente(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text, boxSizing: 'border-box' }} required />
              </div>
              <button type="submit" style={{ backgroundColor: accent, color: '#ffffff', padding: 10, border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Salvar Cliente</button>
            </form>
          </div>

          <div style={{ backgroundColor: cardBg, padding: 20, borderRadius: 12, border: `1px solid ${borderColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, color: text, margin: 0 }}>Lista de Clientes Cadastrados</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={14} color={subtext} />
                <select value={filtroClientes} onChange={(e: any) => setFiltroClientes(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text, fontSize: 12 }}>
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos (Pagos)</option>
                  <option value="naoPagos">Não Pagos</option>
                  <option value="aVencer">Mensalidades a Vencer (4 dias)</option>
                  <option value="inativos">Inativos</option>
                </select>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <th style={{ padding: 10, fontSize: 12, color: subtext }}>Nome</th>
                  <th style={{ padding: 10, fontSize: 12, color: subtext }}>Mensalidade</th>
                  <th style={{ padding: 10, fontSize: 12, color: subtext }}>Status / Alerta</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: 15, textAlign: 'center', fontSize: 12, color: subtext }}>Nenhum cliente encontrado.</td></tr>
                ) : (
                  clientesFiltrados.map(c => {
                    const infoVenc = verificarVencimento(c.dataVencimento);
                    let corStatus = '#f87171';
                    if (c.statusMensalidade === 'Pago') corStatus = '#4ade80';
                    if (c.statusMensalidade === 'Inativo') corStatus = '#9ca3af';

                    return (
                      <tr key={c.id} onClick={() => setClienteSelecionadoDetalhes(c)} style={{ borderBottom: `1px solid ${borderColor}`, cursor: 'pointer', transition: 'background 0.2s' }}>
                        <td style={{ padding: 10, fontSize: 13, color: text, fontWeight: 'bold' }}>{c.nome || c.name}</td>
                        <td style={{ padding: 10, fontSize: 13, color: accent, fontWeight: 'bold' }}>R$ {Number(c.valorMensalidade || 0).toFixed(2)}</td>
                        <td style={{ padding: 10, fontSize: 12 }}>
                          <span style={{ color: corStatus, fontWeight: 'bold', marginRight: 8 }}>{c.statusMensalidade}</span>
                          {c.statusMensalidade !== 'Pago' && c.statusMensalidade !== 'Inativo' && infoVenc.alerta && (
                            <span style={{ backgroundColor: '#ef444422', color: '#f87171', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>⚠️ {infoVenc.texto}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {clienteSelecionadoDetalhes && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: cardBg, padding: 24, borderRadius: 12, border: `1px solid ${borderColor}`, width: 450, maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, color: text }}>Detalhes de {clienteSelecionadoDetalhes.nome || clienteSelecionadoDetalhes.name}</h3>
              <button onClick={() => setClienteSelecionadoDetalhes(null)} style={{ background: 'none', border: 'none', color: subtext, cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, color: subtext }}>Telefone: {clienteSelecionadoDetalhes.telefone || clienteSelecionadoDetalhes.phone}</div>
              <div style={{ fontSize: 13, color: subtext }}>Valor da Mensalidade: <b style={{ color: accent }}>R$ {Number(clienteSelecionadoDetalhes.valorMensalidade || 0).toFixed(2)}</b></div>
              <div style={{ fontSize: 13, color: subtext }}>Vencimento: {clienteSelecionadoDetalhes.dataVencimento}</div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, backgroundColor: dark ? '#141414' : '#f9f9f9', border: `1px solid ${borderColor}` }}>
              <div style={{ fontSize: 12, color: subtext, marginBottom: 8 }}>Status da Mensalidade / Situação:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleAtualizarStatusCliente(clienteSelecionadoDetalhes.id, 'Pago')} style={{ flex: 1, padding: '8px 4px', borderRadius: 6, border: clienteSelecionadoDetalhes.statusMensalidade === 'Pago' ? '2px solid #4ade80' : `1px solid ${borderColor}`, backgroundColor: clienteSelecionadoDetalhes.statusMensalidade === 'Pago' ? '#22c55e22' : 'transparent', color: text, fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>✅ Pago</button>
                <button onClick={() => handleAtualizarStatusCliente(clienteSelecionadoDetalhes.id, 'Pendente (Não Pago)')} style={{ flex: 1, padding: '8px 4px', borderRadius: 6, border: clienteSelecionadoDetalhes.statusMensalidade?.includes('Pendente') ? '2px solid #ef4444' : `1px solid ${borderColor}`, backgroundColor: clienteSelecionadoDetalhes.statusMensalidade?.includes('Pendente') ? '#ef444422' : 'transparent', color: text, fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>❌ Não Pago</button>
                <button onClick={() => handleAtualizarStatusCliente(clienteSelecionadoDetalhes.id, 'Inativo')} style={{ flex: 1, padding: '8px 4px', borderRadius: 6, border: clienteSelecionadoDetalhes.statusMensalidade === 'Inativo' ? '2px solid #9ca3af' : `1px solid ${borderColor}`, backgroundColor: clienteSelecionadoDetalhes.statusMensalidade === 'Inativo' ? '#9ca3af22' : 'transparent', color: text, fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>⚪ Inativo</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button 
                onClick={() => handleExcluirCliente(clienteSelecionadoDetalhes.id)}
                style={{ backgroundColor: '#ef444422', color: '#f87171', border: '1px solid #ef4444', padding: '10px 14px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Trash2 size={15} /> Excluir Cliente
              </button>
              <button onClick={() => setClienteSelecionadoDetalhes(null)} style={{ backgroundColor: accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'produtos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
          <div style={{ backgroundColor: cardBg, padding: 20, borderRadius: 12, border: `1px solid ${borderColor}` }}>
            <h2 style={{ fontSize: 16, color: text, marginBottom: 16 }}>Cadastrar Pré-Treino</h2>
            <form onSubmit={handleCadastrarProduto} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Nome do Produto / Dose</label>
                <input type="text" placeholder="Ex: Pré-Treino Dragon Pharma" value={novoNomeProduto} onChange={(e) => setNovoNomeProduto(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text, boxSizing: 'border-box' }} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: subtext, marginBottom: 6 }}>Custo por Dose (R$)</label>
                <input type="number" step="0.01" placeholder="5.00" value={novoCustoProduto} onChange={(e) => setNovoCustoProduto(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${borderColor}`, backgroundColor: dark ? '#141414' : '#fff', color: text, boxSizing: 'border-box' }} required />
              </div>
              <button type="submit" style={{ backgroundColor: accent, color: '#ffffff', padding: 10, border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Adicionar Produto</button>
            </form>
          </div>

          <div style={{ backgroundColor: cardBg, padding: 20, borderRadius: 12, border: `1px solid ${borderColor}` }}>
            <h2 style={{ fontSize: 16, color: text, marginBottom: 16 }}>Produtos Cadastrados</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <th style={{ padding: 10, fontSize: 12, color: subtext }}>Produto</th>
                  <th style={{ padding: 10, fontSize: 12, color: subtext }}>Custo Unitário</th>
                  <th style={{ padding: 10, fontSize: 12, color: subtext, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {(produtosPreTreino || []).length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: 15, textAlign: 'center', fontSize: 12, color: subtext }}>Nenhum produto cadastrado.</td></tr>
                ) : (
                  (produtosPreTreino || []).map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                      <td style={{ padding: 10, fontSize: 13, color: text, fontWeight: 'bold' }}>{p.nome || p.name}</td>
                      <td style={{ padding: 10, fontSize: 13, color: accent }}>R$ {(p.custo || p.price || 0).toFixed(2)}</td>
                      <td style={{ padding: 10, textAlign: 'right' }}>
                        <button 
                          onClick={() => handleExcluirProduto(p.id)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}
                          title="Excluir produto">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'relatorios' && (
        <div style={{ backgroundColor: cardBg, padding: 20, borderRadius: 12, border: `1px solid ${borderColor}` }}>
          <h2 style={{ fontSize: 16, color: text, marginBottom: 8 }}>Acompanhamento Anual</h2>
          <p style={{ color: subtext, fontSize: 13, margin: '0 0 16px 0' }}>Consolidado mensal de custos gerais e de consumo de pré-treino da base.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((mes, index) => (
              <div key={index} style={{ padding: 14, border: `1px solid ${borderColor}`, borderRadius: 8, backgroundColor: cardBg }}>
                <h3 style={{ fontSize: 14, color: text, margin: '0 0 6px 0' }}>{mes}</h3>
                <p style={{ fontSize: 12, color: subtext, margin: '3px 0' }}>Custo Pré: <b>R$ {totalCustoPreTreinosMes.toFixed(2)}</b></p>
                <p style={{ fontSize: 12, color: subtext, margin: '3px 0' }}>Mensalidades: <b>R$ {totalValorMensalidades.toFixed(2)}</b></p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}