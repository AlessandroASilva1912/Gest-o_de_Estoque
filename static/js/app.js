// ─── STATE ────────────────────────────────────────────────────────────────────
const S = { page: 'dashboard', user: null, categorias: [], fornecedores: [] };
let searchTimeout = null;
let chartInstance = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const r = await api('/api/sessao');
  if (!r || !r.autenticado) { window.location.href = '/'; return; }
  S.user = r;
  document.getElementById('user-name').textContent = r.nome;
  document.getElementById('user-role').textContent = r.perfil;
  document.querySelector('.user-avatar').textContent = r.nome[0].toUpperCase();
  await loadPage('dashboard');
  await atualizarAlertas();
});

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(url, opts) {
  try {
    const options = Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {});
    const r = await fetch(url, options);
    return await r.json();
  } catch (e) {
    toast('Erro de conexão com o servidor', 'error');
    return null;
  }
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg, type) {
  type = type || 'info';
  const icons = { success: icon('check'), error: icon('error'), info: icon('info'), warning: icon('warn') };
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = '<span>' + (icons[type] || icon('info')) + '</span><span>' + msg + '</span>';
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(function() {
    el.classList.add('out');
    setTimeout(function() { el.remove(); }, 400);
  }, 3500);
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function openModal(title, html, wide) {
  document.getElementById('modal-title').innerHTML = title;
  document.getElementById('modal-body').innerHTML = html;
  if (wide) {
    document.getElementById('modal-box').classList.add('wide');
  } else {
    document.getElementById('modal-box').classList.remove('wide');
  }
  document.getElementById('modal').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal')) {
    document.getElementById('modal').classList.remove('open');
  }
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mw = document.getElementById('main-wrap');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('collapsed');
    mw.classList.toggle('expanded');
  }
}

// ─── NAVEGAÇÃO ───────────────────────────────────────────────────────────────
async function loadPage(page) {
  S.page = page;

  document.querySelectorAll('.nav-item[data-page]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.page === page);
  });

  var titles = {
    dashboard: 'Dashboard',
    produtos: 'Produtos',
    fornecedores: 'Fornecedores',
    categorias: 'Categorias',
    entrada: 'Entrada de Estoque',
    saida: 'Saída de Estoque',
    historico: 'Histórico',
    relatorios: 'Relatórios',
    alertas: 'Alertas',
    usuarios: 'Usuários'
  };
  document.getElementById('breadcrumb').textContent = titles[page] || page;
  document.getElementById('page-content').innerHTML = '<div class="loading-page"><div class="spin"></div></div>';

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  var pages = {
    dashboard: pageDashboard,
    produtos: pageProdutos,
    fornecedores: pageFornecedores,
    categorias: pageCategorias,
    entrada: pageEntrada,
    saida: pageSaida,
    historico: pageHistorico,
    relatorios: pageRelatorios,
    alertas: pageAlertas,
    usuarios: pageUsuarios
  };

  if (pages[page]) {
    await pages[page]();
  } else {
    document.getElementById('page-content').innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('empty') + '</div><div class="empty-text">Página não encontrada</div></div>';
  }
}

async function atualizarAlertas() {
  const d = await api('/api/dashboard');
  if (d) {
    const n = d.estoque_baixo || 0;
    document.getElementById('badge-alertas').textContent = n;
    document.getElementById('notif-count').textContent = n;
  }
}

async function sair() {
  await api('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ─── BUSCA GLOBAL ─────────────────────────────────────────────────────────────
async function globalSearch(q) {
  clearTimeout(searchTimeout);
  const res = document.getElementById('search-results');
  if (!q.trim()) { res.classList.remove('show'); return; }
  searchTimeout = setTimeout(async function() {
    const data = await api('/api/produtos?q=' + encodeURIComponent(q));
    if (!data || !data.length) { res.classList.remove('show'); return; }
    var html = '';
    data.slice(0, 8).forEach(function(p) {
      html += '<div class="search-result-item" onclick="loadPage(\'produtos\')">';
      html += '<div><div>' + p.nome + '</div>';
      html += '<div style="font-size:.75rem;color:var(--muted)">' + p.categoria + ' · ' + p.estoque_atual + ' ' + p.unidade + '</div></div>';
      html += '<span class="srid">' + p.codigo + '</span></div>';
    });
    res.innerHTML = html;
    res.classList.add('show');
  }, 300);
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.search-wrap')) {
    var r = document.getElementById('search-results');
    if (r) r.classList.remove('show');
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────────────────────
async function pageDashboard() {
  const d = await api('/api/dashboard');
  if (!d) { document.getElementById('page-content').innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon('error') + '</div><div>Erro ao carregar dashboard</div></div>'; return; }

  function fmtVal(v) { return 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtNum(v) { return parseFloat(v).toLocaleString('pt-BR'); }

  var alertasHtml = '';
  if (d.alertas && d.alertas.length) {
    d.alertas.forEach(function(a) {
      var isCrit = a.atual === 0;
      alertasHtml += '<div class="alert-item ' + (isCrit ? 'alert-critical' : 'alert-low') + '">';
      alertasHtml += '<div class="alert-item-icon">' + (isCrit ? icon('critical') : icon('warn')) + '</div>';
      alertasHtml += '<div class="alert-item-info">';
      alertasHtml += '<div class="alert-item-name">' + a.nome + '</div>';
      alertasHtml += '<div class="alert-item-qty">' + a.atual + ' / ' + a.minimo + ' ' + a.unidade + ' · ' + a.codigo + '</div>';
      alertasHtml += '</div>';
      alertasHtml += '<div class="alert-item-action"><button class="btn btn-success btn-xs" onclick="loadPage(\'entrada\')">Repor</button></div>';
      alertasHtml += '</div>';
    });
  } else {
    alertasHtml = '<div class="empty-state"><div class="empty-icon">' + icon('check') + '</div><div class="empty-text">Tudo em ordem!</div></div>';
  }

  var movsHtml = '';
  if (d.ultimas_movimentacoes && d.ultimas_movimentacoes.length) {
    d.ultimas_movimentacoes.forEach(function(m) {
      var chipCls = m.tipo === 'ENTRADA' ? 'chip-green' : (m.tipo === 'SAIDA' ? 'chip-red' : 'chip-purple');
      var qtdCls = m.tipo === 'ENTRADA' ? 'mov-entry' : (m.tipo === 'SAIDA' ? 'mov-exit' : 'mov-adjust');
      var sinal = m.tipo === 'ENTRADA' ? '+' : (m.tipo === 'SAIDA' ? '-' : '');
      movsHtml += '<tr>';
      movsHtml += '<td><span class="chip ' + chipCls + '">' + m.tipo + '</span></td>';
      movsHtml += '<td>' + m.produto + '</td>';
      movsHtml += '<td class="' + qtdCls + '">' + sinal + m.quantidade + '</td>';
      movsHtml += '<td style="color:var(--muted);font-size:.8rem">' + m.data + '</td>';
      movsHtml += '<td style="color:var(--muted);font-size:.8rem">' + m.usuario + '</td>';
      movsHtml += '</tr>';
    });
  } else {
    movsHtml = '<tr><td colspan="5"><div class="empty-state" style="padding:1rem"><div>Sem movimentações ainda</div></div></td></tr>';
  }

  document.getElementById('page-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Dashboard</div><div class="page-sub">Visão geral do estoque em tempo real</div></div>' +
      '<button class="btn btn-ghost" onclick="loadPage(\'dashboard\')">' + icon('refresh') + 'Atualizar</button>' +
    '</div>' +
    '<div class="stats-grid">' +
      '<div class="stat-card blue"><div class="stat-icon">' + icon('produtos') + '</div><div class="stat-val">' + fmtNum(d.total_produtos) + '</div><div class="stat-label">Produtos ativos</div></div>' +
      '<div class="stat-card green"><div class="stat-icon">' + icon('money') + '</div><div class="stat-val">' + fmtVal(d.valor_total) + '</div><div class="stat-label">Valor em estoque</div></div>' +
      '<div class="stat-card yellow"><div class="stat-icon">' + icon('fornecedores') + '</div><div class="stat-val">' + fmtNum(d.total_fornecedores) + '</div><div class="stat-label">Fornecedores</div></div>' +
      '<div class="stat-card red"><div class="stat-icon">' + icon('warn') + '</div><div class="stat-val">' + fmtNum(d.estoque_baixo) + '</div><div class="stat-label">Estoque baixo</div></div>' +
      '<div class="stat-card blue"><div class="stat-icon">' + icon('entrada') + '</div><div class="stat-val">' + fmtNum(d.entradas_mes) + '</div><div class="stat-label">Entradas no mês</div></div>' +
      '<div class="stat-card purple"><div class="stat-icon">' + icon('saida') + '</div><div class="stat-val">' + fmtNum(d.saidas_mes) + '</div><div class="stat-label">Saídas no mês</div></div>' +
    '</div>' +
    '<div class="grid-2" style="margin-bottom:1rem">' +
      '<div class="panel">' +
        '<div class="panel-head"><span class=\"panel-title\">' + icon('chart') + ' Movimentações — 7 dias</span></div>' +
        '<div class="panel-body"><div class="chart-wrap"><canvas id="chart-mov"></canvas></div></div>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel-head"><span class=\"panel-title\">' + icon('alertas') + ' Alertas de Estoque</span><button class="btn btn-ghost btn-sm" onclick="loadPage(\'alertas\')">Ver todos</button></div>' +
        '<div class="panel-body" style="padding:0 1.25rem">' + alertasHtml + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="panel">' +
      '<div class="panel-head"><span class=\"panel-title\">' + icon('clock') + ' Últimas Movimentações</span><button class="btn btn-ghost btn-sm" onclick="loadPage(\'historico\')">Ver histórico</button></div>' +
      '<div class="table-wrap"><table>' +
        '<thead><tr><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Data</th><th>Usuário</th></tr></thead>' +
        '<tbody>' + movsHtml + '</tbody>' +
      '</table></div>' +
    '</div>';

  var ctx = document.getElementById('chart-mov');
  if (ctx && d.grafico) {
    chartInstance = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: d.grafico.map(function(g) { return g.dia; }),
        datasets: [
          { label: 'Entradas', data: d.grafico.map(function(g) { return g.entradas; }), backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 6 },
          { label: 'Saídas', data: d.grafico.map(function(g) { return g.saidas; }), backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { grid: { color: '#1e2d4a' }, ticks: { color: '#64748b' } },
          y: { grid: { color: '#1e2d4a' }, ticks: { color: '#64748b' } }
        }
      }
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PRODUTOS
// ──────────────────────────────────────────────────────────────────────────────
async function pageProdutos() {
  const prods = await api('/api/produtos');
  const cats = await api('/api/categorias');
  const forns = await api('/api/fornecedores');
  S.categorias = cats || [];
  S.fornecedores = forns || [];
  renderTabelaProdutos(prods || []);
}

function renderTabelaProdutos(prods) {
  var catOpts = '<option value="">Todas categorias</option>';
  S.categorias.forEach(function(c) { catOpts += '<option value="' + c.id + '">' + c.nome + '</option>'; });

  var tbody = '';
  if (!prods.length) {
    tbody = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">' + icon('box') + '</div><div class="empty-text">Nenhum produto cadastrado</div></div></td></tr>';
  } else {
    prods.forEach(function(p) {
      var pct = p.estoque_maximo > 0 ? Math.min(100, (p.estoque_atual / p.estoque_maximo) * 100) : 0;
      var barCls = p.estoque_atual === 0 ? 'critical' : (p.alerta ? 'low' : 'ok');
      var statusHtml;
      if (p.estoque_atual === 0) {
        statusHtml = '<span class="chip chip-red">' + icon('critical') + 'Crítico</span>';
      } else if (p.alerta) {
        statusHtml = '<span class="chip chip-yellow">' + icon('warn') + 'Baixo</span>';
      } else {
        statusHtml = '<span class="chip chip-green">' + icon('check') + 'OK</span>';
      }
      tbody += '<tr>';
      tbody += '<td><code style="font-size:.8rem;color:var(--accent)">' + p.codigo + '</code></td>';
      tbody += '<td><div style="font-weight:500">' + p.nome + '</div><div style="font-size:.75rem;color:var(--muted)">' + (p.localizacao || '') + '</div></td>';
      tbody += '<td><span class="chip chip-gray">' + p.categoria + '</span></td>';
      tbody += '<td>';
      tbody += '<div style="font-weight:600;margin-bottom:.3rem">' + p.estoque_atual + ' ' + p.unidade + '</div>';
      tbody += '<div class="stock-bar"><div class="stock-bar-fill ' + barCls + '" style="width:' + pct + '%"></div></div>';
      tbody += '<div style="font-size:.7rem;color:var(--muted)">mín: ' + p.estoque_minimo + '</div>';
      tbody += '</td>';
      tbody += '<td>R$ ' + p.preco_custo.toFixed(2) + '</td>';
      tbody += '<td>R$ ' + p.preco_venda.toFixed(2) + '</td>';
      tbody += '<td>' + statusHtml + '</td>';
      tbody += '<td><div style="display:flex;gap:.4rem">';
      tbody += '<button class="btn btn-ghost btn-xs" onclick="abrirEditarProduto(' + p.id + ')">' + icon('edit') + '</button>';
      tbody += '<button class="btn btn-success btn-xs" onclick="entradaRapida(' + p.id + ',\'' + p.nome.replace(/'/g, "\\'") + '\',' + p.preco_custo + ')">' + icon('entrada') + '</button>';
      tbody += '<button class="btn btn-danger btn-xs" onclick="deletarProduto(' + p.id + ')">' + icon('trash') + '</button>';
      tbody += '</div></td>';
      tbody += '</tr>';
    });
  }

  document.getElementById('page-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Produtos</div><div class="page-sub">' + prods.length + ' produto(s)</div></div>' +
      '<button class="btn btn-primary" onclick="abrirNovoProduto()">' + icon('plus') + 'Novo Produto</button>' +
    '</div>' +
    '<div class="toolbar">' +
      '<div class="toolbar-search"><input type="text" id="busca-prod" placeholder="Buscar produto..." oninput="filtrarProdutos(this.value)"></div>' +
      '<select class="toolbar-filter" id="fil-cat" onchange="filtrarProdutos(document.getElementById(\'busca-prod\').value)">' + catOpts + '</select>' +
    '</div>' +
    '<div class="panel"><div class="table-wrap"><table>' +
      '<thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Estoque</th><th>P. Custo</th><th>P. Venda</th><th>Status</th><th>Ações</th></tr></thead>' +
      '<tbody id="tb-produtos">' + tbody + '</tbody>' +
    '</table></div></div>';
}

async function filtrarProdutos(q) {
  var cat = document.getElementById('fil-cat') ? document.getElementById('fil-cat').value : '';
  var url = '/api/produtos?q=' + encodeURIComponent(q || '') + '&categoria=' + encodeURIComponent(cat || '');
  const data = await api(url);
  if (data) renderTabelaProdutos(data);
}

function formProdutoHtml(p) {
  p = p || {};
  var catOpts = '<option value="">Selecione...</option>';
  S.categorias.forEach(function(c) {
    catOpts += '<option value="' + c.id + '"' + (p.categoria_id == c.id ? ' selected' : '') + '>' + c.nome + '</option>';
  });
  var fornOpts = '<option value="">Selecione...</option>';
  S.fornecedores.forEach(function(f) {
    fornOpts += '<option value="' + f.id + '"' + (p.fornecedor_id == f.id ? ' selected' : '') + '>' + f.nome + '</option>';
  });
  var unidades = ['UN','KG','LT','MT','CX','PC','PAR','RS'];
  var unitOpts = '';
  unidades.forEach(function(u) {
    unitOpts += '<option value="' + u + '"' + ((p.unidade || 'UN') === u ? ' selected' : '') + '>' + u + '</option>';
  });
  return '<div class="form-grid">' +
    '<div class="form-row">' +
      '<div class="field"><label>Código *</label><input id="f-codigo" value="' + (p.codigo || '') + '" placeholder="PROD-001"' + (p.id ? ' readonly' : '') + '></div>' +
      '<div class="field"><label>Nome *</label><input id="f-nome" value="' + (p.nome || '') + '" placeholder="Nome do produto"></div>' +
    '</div>' +
    '<div class="field"><label>Descrição</label><textarea id="f-desc">' + (p.descricao || '') + '</textarea></div>' +
    '<div class="form-row">' +
      '<div class="field"><label>Categoria</label><select id="f-cat">' + catOpts + '</select></div>' +
      '<div class="field"><label>Fornecedor</label><select id="f-forn">' + fornOpts + '</select></div>' +
    '</div>' +
    '<div class="form-row-3">' +
      '<div class="field"><label>Unidade</label><select id="f-unit">' + unitOpts + '</select></div>' +
      '<div class="field"><label>Preço Custo</label><input id="f-pcusto" type="number" step=".01" min="0" value="' + (p.preco_custo || 0) + '"></div>' +
      '<div class="field"><label>Preço Venda</label><input id="f-pvenda" type="number" step=".01" min="0" value="' + (p.preco_venda || 0) + '"></div>' +
    '</div>' +
    '<div class="form-row-3">' +
      '<div class="field"><label>Estoque Inicial</label><input id="f-atual" type="number" step=".01" min="0" value="' + (p.estoque_atual || 0) + '"' + (p.id ? ' readonly' : '') + '></div>' +
      '<div class="field"><label>Estoque Mínimo</label><input id="f-min" type="number" step=".01" min="0" value="' + (p.estoque_minimo || 5) + '"></div>' +
      '<div class="field"><label>Estoque Máximo</label><input id="f-max" type="number" step=".01" min="0" value="' + (p.estoque_maximo || 100) + '"></div>' +
    '</div>' +
    '<div class="field"><label>Localização</label><input id="f-local" value="' + (p.localizacao || '') + '" placeholder="Ex: Prateleira A3"></div>' +
  '</div>' +
  '<div class="modal-footer" style="padding-top:1rem">' +
    '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="' + (p.id ? 'salvarProduto(' + p.id + ')' : 'criarProduto()') + '">' + icon('save') + ' ' + (p.id ? 'Salvar' : 'Cadastrar') + '</button>' +
  '</div>';
}

function abrirNovoProduto() { openModal('Novo Produto', formProdutoHtml(), true); }

async function abrirEditarProduto(id) {
  const prods = await api('/api/produtos');
  if (!prods) return;
  var p = null;
  prods.forEach(function(x) { if (x.id === id) p = x; });
  if (!p) return;
  openModal('Editar Produto', formProdutoHtml(p), true);
}

function coletarFormProduto() {
  return {
    codigo: document.getElementById('f-codigo').value.trim(),
    nome: document.getElementById('f-nome').value.trim(),
    descricao: document.getElementById('f-desc').value,
    categoria_id: document.getElementById('f-cat').value || null,
    fornecedor_id: document.getElementById('f-forn').value || null,
    unidade: document.getElementById('f-unit').value,
    preco_custo: parseFloat(document.getElementById('f-pcusto').value) || 0,
    preco_venda: parseFloat(document.getElementById('f-pvenda').value) || 0,
    estoque_atual: parseFloat(document.getElementById('f-atual').value) || 0,
    estoque_minimo: parseFloat(document.getElementById('f-min').value) || 0,
    estoque_maximo: parseFloat(document.getElementById('f-max').value) || 0,
    localizacao: document.getElementById('f-local').value
  };
}

async function criarProduto() {
  var body = coletarFormProduto();
  if (!body.codigo || !body.nome) { toast('Preencha o código e o nome', 'error'); return; }
  const r = await api('/api/produtos', { method: 'POST', body: JSON.stringify(body) });
  if (r && r.sucesso) { toast('Produto cadastrado com sucesso!', 'success'); closeModal(); loadPage('produtos'); }
  else { toast((r && r.erro) || 'Erro ao cadastrar produto', 'error'); }
}

async function salvarProduto(id) {
  var body = coletarFormProduto();
  if (!body.nome) { toast('Preencha o nome', 'error'); return; }
  const r = await api('/api/produtos/' + id, { method: 'PUT', body: JSON.stringify(body) });
  if (r && r.sucesso) { toast('Produto atualizado!', 'success'); closeModal(); loadPage('produtos'); }
  else { toast((r && r.erro) || 'Erro ao atualizar', 'error'); }
}

async function deletarProduto(id) {
  if (!confirm('Desativar este produto?')) return;
  const r = await api('/api/produtos/' + id, { method: 'DELETE' });
  if (r && r.sucesso) { toast('Produto desativado', 'info'); loadPage('produtos'); }
}

function entradaRapida(id, nome, preco) {
  openModal('Entrada Rápida — ' + nome,
    '<div class="form-grid">' +
      '<div class="form-row">' +
        '<div class="field"><label>Quantidade *</label><input id="qe-qty" type="number" step=".01" min=".01" placeholder="0" autofocus></div>' +
        '<div class="field"><label>Preço Unitário</label><input id="qe-preco" type="number" step=".01" min="0" value="' + preco + '"></div>' +
      '</div>' +
      '<div class="field"><label>Nota Fiscal</label><input id="qe-nf" placeholder="Número da NF (opcional)"></div>' +
      '<div class="field"><label>Motivo</label><input id="qe-motivo" value="Reposição de estoque"></div>' +
    '</div>' +
    '<div class="modal-footer" style="padding-top:1rem">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn btn-success" onclick="confirmarEntradaRapida(' + id + ')">' + icon('entrada') + 'Confirmar Entrada</button>' +
    '</div>'
  );
}

async function confirmarEntradaRapida(id) {
  var qty = parseFloat(document.getElementById('qe-qty').value);
  if (!qty || qty <= 0) { toast('Informe a quantidade', 'error'); return; }
  var body = {
    produto_id: id, tipo: 'ENTRADA', quantidade: qty,
    preco_unitario: parseFloat(document.getElementById('qe-preco').value) || 0,
    nota_fiscal: document.getElementById('qe-nf').value,
    motivo: document.getElementById('qe-motivo').value
  };
  const r = await api('/api/movimentacoes', { method: 'POST', body: JSON.stringify(body) });
  if (r && r.sucesso) { toast('Entrada registrada! Estoque: ' + r.estoque_atual, 'success'); closeModal(); loadPage('produtos'); }
  else { toast((r && r.erro) || 'Erro', 'error'); }
}

// ──────────────────────────────────────────────────────────────────────────────
// FORNECEDORES
// ──────────────────────────────────────────────────────────────────────────────
async function pageFornecedores() {
  const data = await api('/api/fornecedores');
  var tbody = '';
  if (!data || !data.length) {
    tbody = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">' + icon('fornecedores') + '</div><div class="empty-text">Nenhum fornecedor cadastrado</div></div></td></tr>';
  } else {
    data.forEach(function(f) {
      tbody += '<tr>';
      tbody += '<td><div style="font-weight:500">' + f.nome + '</div><div style="font-size:.75rem;color:var(--muted)">' + (f.cnpj || '-') + '</div></td>';
      tbody += '<td>' + (f.email || '-') + '</td>';
      tbody += '<td>' + (f.telefone || '-') + '</td>';
      tbody += '<td>' + (f.cidade ? f.cidade + '/' + f.estado : '-') + '</td>';
      tbody += '<td><span class="chip chip-blue">' + f.total_produtos + ' produto(s)</span></td>';
      tbody += '<td><div style="display:flex;gap:.4rem">';
      tbody += '<button class="btn btn-ghost btn-xs" onclick="abrirEditarFornecedor(' + f.id + ')">' + icon('edit') + 'Editar</button>';
      tbody += '<button class="btn btn-danger btn-xs" onclick="deletarFornecedor(' + f.id + ')">' + icon('trash') + '</button>';
      tbody += '</div></td>';
      tbody += '</tr>';
    });
  }
  document.getElementById('page-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Fornecedores</div><div class="page-sub">' + (data ? data.length : 0) + ' fornecedor(es)</div></div>' +
      '<button class="btn btn-primary" onclick="abrirNovoFornecedor()">' + icon('plus') + 'Novo Fornecedor</button>' +
    '</div>' +
    '<div class="panel"><div class="table-wrap"><table>' +
      '<thead><tr><th>Nome / CNPJ</th><th>E-mail</th><th>Telefone</th><th>Cidade</th><th>Produtos</th><th>Ações</th></tr></thead>' +
      '<tbody>' + tbody + '</tbody>' +
    '</table></div></div>';
}

function formFornecedorHtml(f) {
  f = f || {};
  var ufs = ['', 'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  var ufOpts = '';
  ufs.forEach(function(u) {
    ufOpts += '<option value="' + u + '"' + ((f.estado || '') === u ? ' selected' : '') + '>' + (u || 'UF') + '</option>';
  });
  return '<div class="form-grid">' +
    '<div class="field"><label>Nome *</label><input id="ff-nome" value="' + (f.nome || '') + '" placeholder="Razão social"></div>' +
    '<div class="form-row">' +
      '<div class="field"><label>CNPJ</label><input id="ff-cnpj" value="' + (f.cnpj || '') + '" placeholder="00.000.000/0001-00"></div>' +
      '<div class="field"><label>Telefone</label><input id="ff-tel" value="' + (f.telefone || '') + '" placeholder="(00) 00000-0000"></div>' +
    '</div>' +
    '<div class="field"><label>E-mail</label><input id="ff-email" type="email" value="' + (f.email || '') + '" placeholder="contato@fornecedor.com"></div>' +
    '<div class="field"><label>Endereço</label><input id="ff-end" value="' + (f.endereco || '') + '" placeholder="Rua, número, bairro"></div>' +
    '<div class="form-row">' +
      '<div class="field"><label>Cidade</label><input id="ff-cidade" value="' + (f.cidade || '') + '" placeholder="Cidade"></div>' +
      '<div class="field"><label>Estado</label><select id="ff-uf">' + ufOpts + '</select></div>' +
    '</div>' +
  '</div>' +
  '<div class="modal-footer" style="padding-top:1rem">' +
    '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
    '<button class="btn btn-primary" onclick="' + (f.id ? 'salvarFornecedor(' + f.id + ')' : 'criarFornecedor()') + '">' + icon('save') + ' ' + (f.id ? 'Salvar' : 'Cadastrar') + '</button>' +
  '</div>';
}

function abrirNovoFornecedor() { openModal('Novo Fornecedor', formFornecedorHtml()); }

async function abrirEditarFornecedor(id) {
  const data = await api('/api/fornecedores');
  if (!data) return;
  var f = null;
  data.forEach(function(x) { if (x.id === id) f = x; });
  if (f) openModal('Editar Fornecedor', formFornecedorHtml(f));
}

function coletarFormFornecedor() {
  return {
    nome: document.getElementById('ff-nome').value.trim(),
    cnpj: document.getElementById('ff-cnpj').value,
    telefone: document.getElementById('ff-tel').value,
    email: document.getElementById('ff-email').value,
    endereco: document.getElementById('ff-end').value,
    cidade: document.getElementById('ff-cidade').value,
    estado: document.getElementById('ff-uf').value
  };
}

async function criarFornecedor() {
  var body = coletarFormFornecedor();
  if (!body.nome) { toast('Informe o nome do fornecedor', 'error'); return; }
  const r = await api('/api/fornecedores', { method: 'POST', body: JSON.stringify(body) });
  if (r && r.sucesso) { toast('Fornecedor cadastrado!', 'success'); closeModal(); pageFornecedores(); }
  else { toast((r && r.erro) || 'Erro', 'error'); }
}

async function salvarFornecedor(id) {
  var body = coletarFormFornecedor();
  if (!body.nome) { toast('Informe o nome', 'error'); return; }
  const r = await api('/api/fornecedores/' + id, { method: 'PUT', body: JSON.stringify(body) });
  if (r && r.sucesso) { toast('Fornecedor atualizado!', 'success'); closeModal(); pageFornecedores(); }
  else { toast((r && r.erro) || 'Erro', 'error'); }
}

async function deletarFornecedor(id) {
  if (!confirm('Desativar este fornecedor?')) return;
  const r = await api('/api/fornecedores/' + id, { method: 'DELETE' });
  if (r && r.sucesso) { toast('Fornecedor desativado', 'info'); pageFornecedores(); }
}

// ──────────────────────────────────────────────────────────────────────────────
// CATEGORIAS
// ──────────────────────────────────────────────────────────────────────────────
async function pageCategorias() {
  const data = await api('/api/categorias');
  var tbody = '';
  if (!data || !data.length) {
    tbody = '<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">' + icon('categorias') + '</div><div>Nenhuma categoria</div></div></td></tr>';
  } else {
    data.forEach(function(c) {
      tbody += '<tr><td>' + c.id + '</td><td style="font-weight:500">' + c.nome + '</td><td style="color:var(--muted)">' + (c.descricao || '-') + '</td></tr>';
    });
  }
  document.getElementById('page-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Categorias</div><div class="page-sub">' + (data ? data.length : 0) + ' categoria(s)</div></div>' +
      '<button class="btn btn-primary" onclick="abrirNovaCategoria()">' + icon('plus') + 'Nova Categoria</button>' +
    '</div>' +
    '<div class="panel"><div class="table-wrap"><table>' +
      '<thead><tr><th>#</th><th>Nome</th><th>Descrição</th></tr></thead>' +
      '<tbody>' + tbody + '</tbody>' +
    '</table></div></div>';
}

function abrirNovaCategoria() {
  openModal('Nova Categoria',
    '<div class="form-grid">' +
      '<div class="field"><label>Nome *</label><input id="nc-nome" placeholder="Nome da categoria" autofocus></div>' +
      '<div class="field"><label>Descrição</label><input id="nc-desc" placeholder="Descrição (opcional)"></div>' +
    '</div>' +
    '<div class="modal-footer" style="padding-top:1rem">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="criarCategoria()">' + icon('save') + 'Criar</button>' +
    '</div>'
  );
}

async function criarCategoria() {
  var nome = document.getElementById('nc-nome').value.trim();
  if (!nome) { toast('Informe o nome', 'error'); return; }
  const r = await api('/api/categorias', { method: 'POST', body: JSON.stringify({ nome: nome, descricao: document.getElementById('nc-desc').value }) });
  if (r && r.sucesso) { toast('Categoria criada!', 'success'); closeModal(); pageCategorias(); }
  else { toast((r && r.erro) || 'Erro', 'error'); }
}

// ──────────────────────────────────────────────────────────────────────────────
// ENTRADA / SAÍDA
// ──────────────────────────────────────────────────────────────────────────────
async function pageEntrada() { await pageMovimentacao('ENTRADA'); }
async function pageSaida() { await pageMovimentacao('SAIDA'); }

async function pageMovimentacao(tipo) {
  const prods = await api('/api/produtos');
  var opts = '<option value="">Selecione o produto...</option>';
  (prods || []).forEach(function(p) {
    var info = tipo === 'ENTRADA'
      ? 'Atual: ' + p.estoque_atual + ' ' + p.unidade
      : 'Disponível: ' + p.estoque_atual + ' ' + p.unidade;
    opts += '<option value="' + p.id + '" data-preco="' + (tipo === 'ENTRADA' ? p.preco_custo : p.preco_venda) + '" data-atual="' + p.estoque_atual + '" data-unit="' + p.unidade + '">' + p.nome + ' (' + p.codigo + ') — ' + info + '</option>';
  });

  var isEntrada = tipo === 'ENTRADA';
  document.getElementById('page-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">' + (isEntrada ? icon('entrada') + ' Entrada de Estoque' : icon('saida') + ' Saída de Estoque') + '</div>' +
      '<div class="page-sub">' + (isEntrada ? 'Registre a entrada de produtos' : 'Registre a saída de produtos') + '</div></div>' +
    '</div>' +
    '<div class="panel" style="max-width:680px">' +
      '<div class="panel-head"><span class="panel-title">Nova ' + (isEntrada ? 'Entrada' : 'Saída') + '</span></div>' +
      '<div class="panel-body">' +
        '<div class="form-grid">' +
          '<div class="field"><label>Produto *</label>' +
            '<select id="mov-prod" onchange="onProdutoSelect(this)">' + opts + '</select>' +
          '</div>' +
          '<div id="prod-info-box" style="display:none;background:var(--card2);border:1px solid var(--border2);border-radius:10px;padding:1rem;margin-top:-.5rem">' +
            '<div id="prod-info-content"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="field"><label>Quantidade *</label><input id="mov-qty" type="number" step=".01" min=".01" placeholder="0.00"></div>' +
            '<div class="field"><label>Preço Unitário</label><input id="mov-preco" type="number" step=".01" min="0" placeholder="0.00"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="field"><label>' + (isEntrada ? 'Nota Fiscal' : 'Destino / Cliente') + '</label><input id="mov-nf" placeholder="Opcional"></div>' +
            '<div class="field"><label>Data</label><input id="mov-data" type="date" value="' + new Date().toISOString().split('T')[0] + '"></div>' +
          '</div>' +
          '<div class="field"><label>Motivo / Observação</label><input id="mov-motivo" value="' + (isEntrada ? 'Compra de estoque' : 'Venda') + '"></div>' +
        '</div>' +
        '<div style="margin-top:1.5rem;display:flex;gap:.75rem">' +
          '<button class="btn ' + (isEntrada ? 'btn-success' : 'btn-danger') + '" style="flex:1' + (!isEntrada ? ';background:linear-gradient(135deg,var(--danger),#f87171);color:#fff' : '') + '" onclick="confirmarMovimentacao(\'' + tipo + '\')">' +
            (isEntrada ? icon('entrada') + ' Registrar Entrada' : icon('saida') + ' Registrar Saída') +
          '</button>' +
          '<button class="btn btn-ghost" onclick="loadPage(\'historico\')">' + icon('historico') + 'Ver Histórico</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function onProdutoSelect(sel) {
  var opt = sel.options[sel.selectedIndex];
  var box = document.getElementById('prod-info-box');
  var content = document.getElementById('prod-info-content');
  var precoInput = document.getElementById('mov-preco');
  if (!opt.value) { box.style.display = 'none'; return; }
  var atual = opt.dataset.atual;
  var preco = opt.dataset.preco;
  var unit = opt.dataset.unit;
  content.innerHTML =
    '<div style="display:flex;gap:2rem">' +
      '<div><div style="font-size:.75rem;color:var(--muted)">ESTOQUE ATUAL</div>' +
      '<div style="font-size:1.3rem;font-weight:700;color:var(--accent)">' + atual + ' ' + unit + '</div></div>' +
      '<div><div style="font-size:.75rem;color:var(--muted)">PREÇO</div>' +
      '<div style="font-size:1.3rem;font-weight:700">R$ ' + parseFloat(preco).toFixed(2) + '</div></div>' +
    '</div>';
  box.style.display = 'block';
  if (precoInput) precoInput.value = preco;
}

async function confirmarMovimentacao(tipo) {
  var prod = document.getElementById('mov-prod').value;
  var qty = parseFloat(document.getElementById('mov-qty').value);
  if (!prod) { toast('Selecione o produto', 'error'); return; }
  if (!qty || qty <= 0) { toast('Informe a quantidade válida', 'error'); return; }
  var body = {
    produto_id: parseInt(prod),
    tipo: tipo,
    quantidade: qty,
    preco_unitario: parseFloat(document.getElementById('mov-preco').value) || 0,
    nota_fiscal: document.getElementById('mov-nf').value,
    motivo: document.getElementById('mov-motivo').value
  };
  const r = await api('/api/movimentacoes', { method: 'POST', body: JSON.stringify(body) });
  if (r && r.sucesso) {
    toast((tipo === 'ENTRADA' ? 'Entrada' : 'Saída') + ' registrada! Estoque atual: ' + r.estoque_atual, 'success');
    atualizarAlertas();
    if (tipo === 'ENTRADA') pageEntrada(); else pageSaida();
  } else {
    toast((r && r.erro) || 'Erro ao registrar', 'error');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// HISTÓRICO
// ──────────────────────────────────────────────────────────────────────────────
async function pageHistorico() {
  const data = await api('/api/movimentacoes');
  var tbody = '';
  if (!data || !data.length) {
    tbody = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">' + icon('historico') + '</div><div>Sem movimentações</div></div></td></tr>';
  } else {
    data.forEach(function(m) {
      var chipCls = m.tipo === 'ENTRADA' ? 'chip-green' : (m.tipo === 'SAIDA' ? 'chip-red' : 'chip-purple');
      var qtdCls = m.tipo === 'ENTRADA' ? 'mov-entry' : (m.tipo === 'SAIDA' ? 'mov-exit' : 'mov-adjust');
      var sinal = m.tipo === 'ENTRADA' ? '+' : (m.tipo === 'SAIDA' ? '-' : '');
      tbody += '<tr>';
      tbody += '<td style="color:var(--muted);font-size:.8rem">' + m.data + '</td>';
      tbody += '<td><span class="chip ' + chipCls + '">' + m.tipo + '</span></td>';
      tbody += '<td><div>' + m.produto + '</div><div style="font-size:.75rem;color:var(--muted)">' + m.codigo + '</div></td>';
      tbody += '<td class="' + qtdCls + '" style="font-weight:600">' + sinal + m.quantidade + '</td>';
      tbody += '<td>R$ ' + m.preco_unitario.toFixed(2) + '</td>';
      tbody += '<td style="font-weight:600">R$ ' + m.total.toFixed(2) + '</td>';
      tbody += '<td style="color:var(--muted);font-size:.8rem">' + (m.nota_fiscal || '-') + '</td>';
      tbody += '<td style="color:var(--muted);font-size:.8rem">' + m.usuario + '</td>';
      tbody += '</tr>';
    });
  }
  document.getElementById('page-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Histórico de Movimentações</div><div class="page-sub">' + (data ? data.length : 0) + ' registro(s)</div></div>' +
    '</div>' +
    '<div class="panel"><div class="table-wrap"><table>' +
      '<thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>P. Unit.</th><th>Total</th><th>NF</th><th>Usuário</th></tr></thead>' +
      '<tbody>' + tbody + '</tbody>' +
    '</table></div></div>';
}

// ──────────────────────────────────────────────────────────────────────────────
// RELATÓRIOS
// ──────────────────────────────────────────────────────────────────────────────
async function pageRelatorios() {
  document.getElementById('page-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Relatórios</div><div class="page-sub">Análises completas do estoque</div></div>' +
    '</div>' +
    '<div class="grid-3" style="margin-bottom:1.5rem">' +
      '<div class="stat-card blue" style="cursor:pointer" onclick="relEstoqueAtual()">' +
        '<div class="stat-icon">' + icon('box') + '</div><div class="stat-val" style="font-size:1rem;margin-top:.3rem">' + icon('box') + 'Estoque Atual</div>' +
        '<div class="stat-label">Posição de todos os produtos</div>' +
      '</div>' +
      '<div class="stat-card red" style="cursor:pointer" onclick="relProdutosCriticos()">' +
        '<div class="stat-icon">' + icon('warn') + '</div><div class="stat-val" style="font-size:1rem;margin-top:.3rem">' + icon('warn') + 'Estoque Crítico</div>' +
        '<div class="stat-label">Produtos abaixo do mínimo</div>' +
      '</div>' +
      '<div class="stat-card green" style="cursor:pointer" onclick="relValorEstoque()">' +
        '<div class="stat-icon">' + icon('money') + '</div><div class="stat-val" style="font-size:1rem;margin-top:.3rem">' + icon('money') + 'Valor em Estoque</div>' +
        '<div class="stat-label">Valor total do inventário</div>' +
      '</div>' +
    '</div>' +
    '<div class="panel">' +
      '<div class="panel-head"><span class=\"panel-title\">' + icon('relatorios') + ' Movimentações por Período</span></div>' +
      '<div class="panel-body">' +
        '<div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:1.2rem">' +
          '<div class="field"><label>Data Inicial</label><input type="date" id="rel-ini"></div>' +
          '<div class="field"><label>Data Final</label><input type="date" id="rel-fim"></div>' +
          '<button class="btn btn-primary" onclick="gerarRelMovimentacoes()">' + icon('search') + 'Gerar Relatório</button>' +
        '</div>' +
        '<div id="rel-resultado"><div class="empty-state"><div class="empty-icon">' + icon('relatorios') + '</div><div>Selecione o período e clique em Gerar</div></div></div>' +
      '</div>' +
    '</div>';
}

async function relEstoqueAtual() {
  const data = await api('/api/relatorios/estoque');
  if (!data) return;
  var total = 0;
  data.forEach(function(p) { total += p.valor_estoque; });
  var tbody = '';
  data.forEach(function(p) {
    var cls = p.status === 'OK' ? 'chip-green' : (p.status === 'BAIXO' ? 'chip-yellow' : 'chip-red');
    tbody += '<tr>';
    tbody += '<td><code style="color:var(--accent)">' + p.codigo + '</code></td>';
    tbody += '<td>' + p.nome + '</td>';
    tbody += '<td><span class="chip chip-gray">' + p.categoria + '</span></td>';
    tbody += '<td>' + p.estoque_atual + ' ' + p.unidade + '</td>';
    tbody += '<td>' + p.estoque_minimo + '</td>';
    tbody += '<td>R$ ' + p.preco_custo.toFixed(2) + '</td>';
    tbody += '<td style="font-weight:600">R$ ' + p.valor_estoque.toFixed(2) + '</td>';
    tbody += '<td><span class="chip ' + cls + '">' + p.status + '</span></td>';
    tbody += '</tr>';
  });
  openModal('Estoque Atual — Total: R$ ' + total.toFixed(2),
    '<div class="table-wrap" style="max-height:440px;overflow-y:auto"><table>' +
      '<thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Qtd</th><th>Mín.</th><th>Custo</th><th>Valor Total</th><th>Status</th></tr></thead>' +
      '<tbody>' + tbody + '</tbody>' +
    '</table></div>', true);
}

async function relProdutosCriticos() {
  const data = await api('/api/relatorios/estoque');
  if (!data) return;
  var criticos = data.filter(function(p) { return p.status !== 'OK'; });
  var tbody = '';
  if (!criticos.length) {
    tbody = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">' + icon('check') + '</div><div>Todos os produtos estão em estoque adequado!</div></div></td></tr>';
  } else {
    criticos.forEach(function(p) {
      var cls = p.status === 'CRITICO' ? 'chip-red' : 'chip-yellow';
      var qtdCls = p.status === 'CRITICO' ? 'mov-exit' : 'mov-adjust';
      tbody += '<tr>';
      tbody += '<td><code style="color:var(--danger)">' + p.codigo + '</code></td>';
      tbody += '<td>' + p.nome + '</td>';
      tbody += '<td class="' + qtdCls + '" style="font-weight:700">' + p.estoque_atual + '</td>';
      tbody += '<td>' + p.estoque_minimo + '</td>';
      tbody += '<td><span class="chip ' + cls + '">' + p.status + '</span></td>';
      tbody += '</tr>';
    });
  }
  openModal('Produtos Críticos/Baixos (' + criticos.length + ')',
    '<div class="table-wrap"><table>' +
      '<thead><tr><th>Código</th><th>Produto</th><th>Atual</th><th>Mínimo</th><th>Status</th></tr></thead>' +
      '<tbody>' + tbody + '</tbody>' +
    '</table></div>', true);
}

async function relValorEstoque() {
  const data = await api('/api/relatorios/estoque');
  if (!data) return;
  var total = 0, totalVenda = 0, qtdItens = 0;
  data.forEach(function(p) {
    total += p.valor_estoque;
    totalVenda += p.estoque_atual * p.preco_venda;
    qtdItens += p.estoque_atual;
  });
  openModal('Valor em Estoque',
    '<div class="kpi-row" style="margin-bottom:1.5rem">' +
      '<div class="kpi-item"><div class="kpi-num" style="color:var(--accent)">R$ ' + total.toFixed(2) + '</div><div class="kpi-label">Valor de Custo</div></div>' +
      '<div class="kpi-item"><div class="kpi-num" style="color:var(--success)">R$ ' + totalVenda.toFixed(2) + '</div><div class="kpi-label">Valor de Venda</div></div>' +
      '<div class="kpi-item"><div class="kpi-num">' + data.length + '</div><div class="kpi-label">Produtos</div></div>' +
      '<div class="kpi-item"><div class="kpi-num">' + qtdItens.toFixed(0) + '</div><div class="kpi-label">Total de Itens</div></div>' +
    '</div>' +
    '<div style="color:var(--muted);font-size:.85rem;text-align:center">Margem potencial: R$ ' + (totalVenda - total).toFixed(2) + '</div>'
  );
}

async function gerarRelMovimentacoes() {
  var ini = document.getElementById('rel-ini').value;
  var fim = document.getElementById('rel-fim').value;
  var url = '/api/relatorios/movimentacoes';
  var params = [];
  if (ini) params.push('data_ini=' + ini);
  if (fim) params.push('data_fim=' + fim);
  if (params.length) url += '?' + params.join('&');
  const data = await api(url);
  if (!data) return;
  var totalEnt = 0, totalSai = 0;
  data.forEach(function(m) {
    if (m.tipo === 'ENTRADA') totalEnt += m.total;
    else if (m.tipo === 'SAIDA') totalSai += m.total;
  });
  var tbody = '';
  if (!data.length) {
    tbody = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">' + icon('historico') + '</div><div>Nenhuma movimentação no período</div></div></td></tr>';
  } else {
    data.forEach(function(m) {
      var chipCls = m.tipo === 'ENTRADA' ? 'chip-green' : 'chip-red';
      tbody += '<tr>';
      tbody += '<td style="font-size:.8rem;color:var(--muted)">' + m.data + '</td>';
      tbody += '<td><span class="chip ' + chipCls + '">' + m.tipo + '</span></td>';
      tbody += '<td>' + m.produto + '</td>';
      tbody += '<td>' + m.quantidade + '</td>';
      tbody += '<td>R$ ' + m.preco_unitario.toFixed(2) + '</td>';
      tbody += '<td style="font-weight:600">R$ ' + m.total.toFixed(2) + '</td>';
      tbody += '<td style="font-size:.8rem;color:var(--muted)">' + m.usuario + '</td>';
      tbody += '</tr>';
    });
  }
  document.getElementById('rel-resultado').innerHTML =
    '<div class="kpi-row" style="margin-bottom:1rem">' +
      '<div class="kpi-item"><div class="kpi-num mov-entry">R$ ' + totalEnt.toFixed(2) + '</div><div class="kpi-label">Total Entradas</div></div>' +
      '<div class="kpi-item"><div class="kpi-num mov-exit">R$ ' + totalSai.toFixed(2) + '</div><div class="kpi-label">Total Saídas</div></div>' +
      '<div class="kpi-item"><div class="kpi-num">' + data.length + '</div><div class="kpi-label">Movimentações</div></div>' +
    '</div>' +
    '<div class="table-wrap" style="max-height:360px;overflow-y:auto"><table>' +
      '<thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Qtd</th><th>P. Unit.</th><th>Total</th><th>Usuário</th></tr></thead>' +
      '<tbody>' + tbody + '</tbody>' +
    '</table></div>';
}

// ──────────────────────────────────────────────────────────────────────────────
// ALERTAS
// ──────────────────────────────────────────────────────────────────────────────
async function pageAlertas() {
  const data = await api('/api/relatorios/estoque');
  if (!data) return;
  var criticos = data.filter(function(p) { return p.status === 'CRITICO'; });
  var baixos = data.filter(function(p) { return p.status === 'BAIXO'; });

  var html = '<div class="page-header">' +
    '<div><div class=\"page-title\">' + icon('alertas') + ' Alertas de Estoque</div>' +
    '<div class="page-sub">' + criticos.length + ' crítico(s) · ' + baixos.length + ' baixo(s)</div></div>' +
    '<button class="btn btn-ghost" onclick="loadPage(\'alertas\')">' + icon('refresh') + 'Atualizar</button>' +
  '</div>';

  function tabelaAlertas(items, titulo, cor, iconTd) {
    if (!items.length) return '';
    var tbody = '';
    items.forEach(function(p) {
      tbody += '<tr>';
      tbody += '<td><code style="color:' + cor + '">' + p.codigo + '</code></td>';
      tbody += '<td style="font-weight:500">' + p.nome + '</td>';
      tbody += '<td><span class="chip chip-gray">' + p.categoria + '</span></td>';
      tbody += '<td style="font-weight:700;color:' + cor + '">' + p.estoque_atual + ' ' + p.unidade + '</td>';
      tbody += '<td>' + p.estoque_minimo + '</td>';
      tbody += '<td><button class="btn btn-success btn-sm" onclick="loadPage(\'entrada\')">' + icon('entrada') + 'Repor</button></td>';
      tbody += '</tr>';
    });
    return '<div class="panel" style="margin-bottom:1rem;border-color:' + cor + '33">' +
      '<div class="panel-head" style="background:' + cor + '11">' +
        '<span class="panel-title" style="color:' + cor + '">' + titulo + ' (' + items.length + ')</span>' +
      '</div>' +
      '<div class="table-wrap"><table>' +
        '<thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Atual</th><th>Mínimo</th><th>Ação</th></tr></thead>' +
        '<tbody>' + tbody + '</tbody>' +
      '</table></div>' +
    '</div>';
  }

  html += tabelaAlertas(criticos, icon('critical') + ' Crítico — Sem Estoque', '#ef4444', '');
  html += tabelaAlertas(baixos, icon('warn') + ' Baixo — Abaixo do Mínimo', '#f59e0b', '');

  if (!criticos.length && !baixos.length) {
    html += '<div class="panel"><div class="panel-body"><div class="empty-state"><div class="empty-icon">' + icon('check') + '</div><div class="empty-text">Todos os produtos estão com estoque adequado!</div></div></div></div>';
  }

  document.getElementById('page-content').innerHTML = html;
}

// ──────────────────────────────────────────────────────────────────────────────
// USUÁRIOS
// ──────────────────────────────────────────────────────────────────────────────
async function pageUsuarios() {
  if (S.user && S.user.perfil !== 'admin' && S.user.perfil !== 'gerente') {
    document.getElementById('page-content').innerHTML =
      '<div class="panel"><div class="panel-body"><div class="empty-state"><div class="empty-icon">' + icon('lock') + '</div><div class="empty-text">Acesso restrito a administradores</div></div></div></div>';
    return;
  }
  const data = await api('/api/usuarios');
  var tbody = '';
  if (!data || !data.length) {
    tbody = '<tr><td colspan="6"><div class="empty-state"><div class=\"empty-icon\">' + icon('usuarios') + '</div><div>Nenhum usuário</div></div></td></tr>';
  } else {
    data.forEach(function(u) {
      var perfilCls = u.perfil === 'admin' ? 'chip-red' : (u.perfil === 'gerente' ? 'chip-blue' : 'chip-gray');
      tbody += '<tr>';
      tbody += '<td><div style="display:flex;align-items:center;gap:.75rem">' +
        '<div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-weight:700;color:#fff;flex-shrink:0">' + u.nome[0].toUpperCase() + '</div>' +
        '<div><div style="font-weight:500">' + u.nome + '</div><div style="font-size:.75rem;color:var(--muted)">' + u.email + '</div></div>' +
      '</div></td>';
      tbody += '<td><span class="chip ' + perfilCls + '">' + u.perfil + '</span></td>';
      tbody += '<td><span class="chip ' + (u.ativo ? 'chip-green' : 'chip-gray') + '">' + (u.ativo ? 'Ativo' : 'Inativo') + '</span></td>';
      tbody += '<td style="color:var(--muted);font-size:.8rem">' + u.criado_em + '</td>';
      tbody += '<td style="color:var(--muted);font-size:.8rem">' + u.ultimo_login + '</td>';
      tbody += '<td><button class="btn btn-ghost btn-xs" onclick="abrirEditarUsuario(' + u.id + ',\'' + u.nome.replace(/'/g, "\\'") + '\',\'' + u.perfil + '\',' + u.ativo + ')">' + icon('edit') + 'Editar</button></td>';
      tbody += '</tr>';
    });
  }
  document.getElementById('page-content').innerHTML =
    '<div class="page-header">' +
      '<div><div class="page-title">Usuários do Sistema</div><div class="page-sub">' + (data ? data.length : 0) + ' usuário(s)</div></div>' +
    '</div>' +
    '<div class="panel"><div class="table-wrap"><table>' +
      '<thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Cadastro</th><th>Último Login</th><th>Ações</th></tr></thead>' +
      '<tbody>' + tbody + '</tbody>' +
    '</table></div></div>';
}

function abrirEditarUsuario(id, nome, perfil, ativo) {
  openModal('Editar Usuário',
    '<div class="form-grid">' +
      '<div class="field"><label>Nome</label><input id="eu-nome" value="' + nome + '"></div>' +
      '<div class="field"><label>Perfil</label>' +
        '<select id="eu-perfil">' +
          '<option value="operador"' + (perfil === 'operador' ? ' selected' : '') + '>Operador</option>' +
          '<option value="gerente"' + (perfil === 'gerente' ? ' selected' : '') + '>Gerente</option>' +
          '<option value="admin"' + (perfil === 'admin' ? ' selected' : '') + '>Administrador</option>' +
        '</select>' +
      '</div>' +
      '<div class="field"><label>Status</label>' +
        '<select id="eu-ativo">' +
          '<option value="1"' + (ativo ? ' selected' : '') + '>Ativo</option>' +
          '<option value="0"' + (!ativo ? ' selected' : '') + '>Inativo</option>' +
        '</select>' +
      '</div>' +
      '<div class="field"><label>Nova Senha (deixe em branco para manter)</label><input id="eu-senha" type="password" placeholder="Nova senha..."></div>' +
    '</div>' +
    '<div class="modal-footer" style="padding-top:1rem">' +
      '<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="salvarUsuario(' + id + ')">' + icon('save') + 'Salvar</button>' +
    '</div>'
  );
}

async function salvarUsuario(id) {
  var body = {
    nome: document.getElementById('eu-nome').value,
    perfil: document.getElementById('eu-perfil').value,
    ativo: document.getElementById('eu-ativo').value === '1',
    senha: document.getElementById('eu-senha').value || null
  };
  const r = await api('/api/usuarios/' + id, { method: 'PUT', body: JSON.stringify(body) });
  if (r && r.sucesso) { toast('Usuário atualizado!', 'success'); closeModal(); pageUsuarios(); }
  else { toast((r && r.erro) || 'Erro', 'error'); }
}
