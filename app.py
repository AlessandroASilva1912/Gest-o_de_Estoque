import sqlite3, os, hashlib
from flask import Flask, render_template, request, jsonify, session, redirect, g
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
app.secret_key = 'stockpro_secret_2024_xK9mP3qR'
DB_PATH = os.path.join(os.path.dirname(__file__), 'estoque.db')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db: db.close()

def query(sql, args=(), one=False):
    cur = get_db().execute(sql, args)
    rv = cur.fetchall()
    return (rv[0] if rv else None) if one else rv

def execute(sql, args=()):
    db = get_db()
    cur = db.execute(sql, args)
    db.commit()
    return cur.lastrowid

def hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()
def check_pw(pw, h): return hash_pw(pw) == h

def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript('''
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL, senha_hash TEXT NOT NULL,
        perfil TEXT DEFAULT 'operador', ativo INTEGER DEFAULT 1,
        criado_em TEXT DEFAULT (datetime('now')), ultimo_login TEXT);
    CREATE TABLE IF NOT EXISTS fornecedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL,
        cnpj TEXT, email TEXT, telefone TEXT, endereco TEXT,
        cidade TEXT, estado TEXT, ativo INTEGER DEFAULT 1,
        criado_em TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE NOT NULL, descricao TEXT);
    CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT UNIQUE NOT NULL,
        nome TEXT NOT NULL, descricao TEXT, unidade TEXT DEFAULT 'UN',
        preco_custo REAL DEFAULT 0, preco_venda REAL DEFAULT 0,
        estoque_atual REAL DEFAULT 0, estoque_minimo REAL DEFAULT 5,
        estoque_maximo REAL DEFAULT 100, localizacao TEXT, ativo INTEGER DEFAULT 1,
        criado_em TEXT DEFAULT (datetime('now')),
        categoria_id INTEGER REFERENCES categorias(id),
        fornecedor_id INTEGER REFERENCES fornecedores(id));
    CREATE TABLE IF NOT EXISTS movimentacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL,
        quantidade REAL NOT NULL, preco_unitario REAL DEFAULT 0,
        motivo TEXT, nota_fiscal TEXT, data TEXT DEFAULT (datetime('now')),
        produto_id INTEGER NOT NULL REFERENCES produtos(id),
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id));
    ''')
    for c in ['Eletronicos','Papelaria','Limpeza','Ferramentas','Informatica','Alimentacao']:
        db.execute('INSERT OR IGNORE INTO categorias(nome) VALUES(?)', (c,))
    db.commit(); db.close()

def login_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if 'uid' not in session: return jsonify({'erro':'Nao autenticado'}),401
        return f(*a, **kw)
    return dec

def admin_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if 'uid' not in session: return jsonify({'erro':'Nao autenticado'}),401
        if session.get('perfil') not in ('admin','gerente'): return jsonify({'erro':'Sem permissao'}),403
        return f(*a, **kw)
    return dec

@app.route('/')
def index():
    return redirect('/dashboard') if 'uid' in session else render_template('login.html')

@app.route('/dashboard')
def dashboard_page():
    if 'uid' not in session: return redirect('/')
    return render_template('dashboard.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    d = request.json
    u = query('SELECT * FROM usuarios WHERE email=? AND ativo=1', (d.get('email',''),), one=True)
    if not u or not check_pw(d.get('senha',''), u['senha_hash']):
        return jsonify({'erro':'E-mail ou senha invalidos'}),401
    execute('UPDATE usuarios SET ultimo_login=? WHERE id=?', (datetime.utcnow().isoformat(), u['id']))
    session.update({'uid':u['id'],'nome':u['nome'],'perfil':u['perfil']})
    return jsonify({'sucesso':True,'nome':u['nome'],'perfil':u['perfil']})

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear(); return jsonify({'sucesso':True})

@app.route('/api/cadastro', methods=['POST'])
def api_cadastro():
    d = request.json
    if query('SELECT id FROM usuarios WHERE email=?', (d.get('email',''),), one=True):
        return jsonify({'erro':'E-mail ja cadastrado'}),400
    cnt = query('SELECT COUNT(*) c FROM usuarios', one=True)['c']
    perfil = 'admin' if cnt == 0 else 'operador'
    execute('INSERT INTO usuarios(nome,email,senha_hash,perfil) VALUES(?,?,?,?)',
            (d['nome'],d['email'],hash_pw(d['senha']),perfil))
    return jsonify({'sucesso':True})

@app.route('/api/sessao')
def api_sessao():
    if 'uid' not in session: return jsonify({'autenticado':False})
    return jsonify({'autenticado':True,'nome':session['nome'],'perfil':session['perfil']})

@app.route('/api/dashboard')
@login_required
def api_dashboard():
    tp = query('SELECT COUNT(*) c FROM produtos WHERE ativo=1',one=True)['c']
    tf = query('SELECT COUNT(*) c FROM fornecedores WHERE ativo=1',one=True)['c']
    baixo = query('SELECT COUNT(*) c FROM produtos WHERE ativo=1 AND estoque_atual<=estoque_minimo',one=True)['c']
    val = query('SELECT SUM(estoque_atual*preco_custo) v FROM produtos WHERE ativo=1',one=True)['v'] or 0
    ini = datetime.utcnow().replace(day=1).strftime('%Y-%m-%d')
    em = query("SELECT COALESCE(SUM(quantidade),0) v FROM movimentacoes WHERE tipo='ENTRADA' AND date(data)>=?", (ini,),one=True)['v']
    sm = query("SELECT COALESCE(SUM(quantidade),0) v FROM movimentacoes WHERE tipo='SAIDA' AND date(data)>=?", (ini,),one=True)['v']
    movs = query('SELECT m.*,p.nome pnome,u.nome unome FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id JOIN usuarios u ON u.id=m.usuario_id ORDER BY m.data DESC LIMIT 10')
    alts = query('SELECT * FROM produtos WHERE ativo=1 AND estoque_atual<=estoque_minimo ORDER BY estoque_atual LIMIT 8')
    grafico=[]
    for i in range(6,-1,-1):
        dia=(datetime.utcnow()-timedelta(days=i)).strftime('%Y-%m-%d')
        e=query("SELECT COALESCE(SUM(quantidade),0) v FROM movimentacoes WHERE tipo='ENTRADA' AND date(data)=?",(dia,),one=True)['v']
        s=query("SELECT COALESCE(SUM(quantidade),0) v FROM movimentacoes WHERE tipo='SAIDA' AND date(data)=?",(dia,),one=True)['v']
        grafico.append({'dia':dia[5:],'entradas':float(e),'saidas':float(s)})
    return jsonify({'total_produtos':tp,'total_fornecedores':tf,'estoque_baixo':baixo,'valor_total':round(float(val),2),
        'entradas_mes':float(em),'saidas_mes':float(sm),
        'ultimas_movimentacoes':[{'tipo':m['tipo'],'produto':m['pnome'],'quantidade':m['quantidade'],'data':m['data'][:16].replace('T',' '),'usuario':m['unome']} for m in movs],
        'alertas':[{'id':a['id'],'nome':a['nome'],'codigo':a['codigo'],'atual':a['estoque_atual'],'minimo':a['estoque_minimo'],'unidade':a['unidade']} for a in alts],
        'grafico':grafico})

@app.route('/api/produtos')
@login_required
def api_produtos():
    q,cat=request.args.get('q',''),request.args.get('categoria','')
    sql='SELECT p.*,c.nome cnome,f.nome fnome FROM produtos p LEFT JOIN categorias c ON c.id=p.categoria_id LEFT JOIN fornecedores f ON f.id=p.fornecedor_id WHERE p.ativo=1'
    args=[]
    if q: sql+=' AND (p.nome LIKE ? OR p.codigo LIKE ?)'; args+=[f'%{q}%',f'%{q}%']
    if cat: sql+=' AND p.categoria_id=?'; args.append(cat)
    sql+=' ORDER BY p.nome'
    rows=query(sql,args)
    return jsonify([{'id':r['id'],'codigo':r['codigo'],'nome':r['nome'],'categoria':r['cnome'] or '-','fornecedor':r['fnome'] or '-',
        'categoria_id':r['categoria_id'],'fornecedor_id':r['fornecedor_id'],'unidade':r['unidade'],
        'preco_custo':r['preco_custo'],'preco_venda':r['preco_venda'],'estoque_atual':r['estoque_atual'],
        'estoque_minimo':r['estoque_minimo'],'estoque_maximo':r['estoque_maximo'],
        'localizacao':r['localizacao'] or '','alerta':r['estoque_atual']<=r['estoque_minimo']} for r in rows])

@app.route('/api/produtos',methods=['POST'])
@login_required
def api_criar_produto():
    d=request.json
    if query('SELECT id FROM produtos WHERE codigo=?',(d.get('codigo',''),),one=True):
        return jsonify({'erro':'Codigo ja existe'}),400
    pid=execute('INSERT INTO produtos(codigo,nome,descricao,unidade,preco_custo,preco_venda,estoque_atual,estoque_minimo,estoque_maximo,localizacao,categoria_id,fornecedor_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        (d['codigo'],d['nome'],d.get('descricao',''),d.get('unidade','UN'),float(d.get('preco_custo',0)),float(d.get('preco_venda',0)),
         float(d.get('estoque_atual',0)),float(d.get('estoque_minimo',5)),float(d.get('estoque_maximo',100)),
         d.get('localizacao',''),d.get('categoria_id') or None,d.get('fornecedor_id') or None))
    if float(d.get('estoque_atual',0))>0:
        execute('INSERT INTO movimentacoes(tipo,quantidade,preco_unitario,motivo,produto_id,usuario_id) VALUES(?,?,?,?,?,?)',
            ('ENTRADA',float(d['estoque_atual']),float(d.get('preco_custo',0)),'Estoque inicial',pid,session['uid']))
    return jsonify({'sucesso':True,'id':pid})

@app.route('/api/produtos/<int:pid>',methods=['PUT'])
@login_required
def api_editar_produto(pid):
    d=request.json
    execute('UPDATE produtos SET nome=?,descricao=?,unidade=?,preco_custo=?,preco_venda=?,estoque_minimo=?,estoque_maximo=?,localizacao=?,categoria_id=?,fornecedor_id=? WHERE id=?',
        (d.get('nome'),d.get('descricao'),d.get('unidade'),float(d.get('preco_custo',0)),float(d.get('preco_venda',0)),
         float(d.get('estoque_minimo',5)),float(d.get('estoque_maximo',100)),d.get('localizacao'),
         d.get('categoria_id') or None,d.get('fornecedor_id') or None,pid))
    return jsonify({'sucesso':True})

@app.route('/api/produtos/<int:pid>',methods=['DELETE'])
@admin_required
def api_del_produto(pid):
    execute('UPDATE produtos SET ativo=0 WHERE id=?',(pid,)); return jsonify({'sucesso':True})

@app.route('/api/fornecedores')
@login_required
def api_fornecedores():
    rows=query('SELECT f.*,(SELECT COUNT(*) FROM produtos WHERE fornecedor_id=f.id AND ativo=1) tp FROM fornecedores f WHERE f.ativo=1 ORDER BY f.nome')
    return jsonify([{'id':r['id'],'nome':r['nome'],'cnpj':r['cnpj'] or '','email':r['email'] or '','telefone':r['telefone'] or '',
        'cidade':r['cidade'] or '','estado':r['estado'] or '','endereco':r['endereco'] or '','total_produtos':r['tp']} for r in rows])

@app.route('/api/fornecedores',methods=['POST'])
@login_required
def api_criar_forn():
    d=request.json
    fid=execute('INSERT INTO fornecedores(nome,cnpj,email,telefone,endereco,cidade,estado) VALUES(?,?,?,?,?,?,?)',
        (d['nome'],d.get('cnpj',''),d.get('email',''),d.get('telefone',''),d.get('endereco',''),d.get('cidade',''),d.get('estado','')))
    return jsonify({'sucesso':True,'id':fid})

@app.route('/api/fornecedores/<int:fid>',methods=['PUT'])
@login_required
def api_editar_forn(fid):
    d=request.json
    execute('UPDATE fornecedores SET nome=?,cnpj=?,email=?,telefone=?,endereco=?,cidade=?,estado=? WHERE id=?',
        (d.get('nome'),d.get('cnpj'),d.get('email'),d.get('telefone'),d.get('endereco'),d.get('cidade'),d.get('estado'),fid))
    return jsonify({'sucesso':True})

@app.route('/api/fornecedores/<int:fid>',methods=['DELETE'])
@admin_required
def api_del_forn(fid):
    execute('UPDATE fornecedores SET ativo=0 WHERE id=?',(fid,)); return jsonify({'sucesso':True})

@app.route('/api/categorias')
@login_required
def api_cats():
    return jsonify([{'id':r['id'],'nome':r['nome'],'descricao':r['descricao'] or ''} for r in query('SELECT * FROM categorias ORDER BY nome')])

@app.route('/api/categorias',methods=['POST'])
@login_required
def api_criar_cat():
    d=request.json
    cid=execute('INSERT OR IGNORE INTO categorias(nome,descricao) VALUES(?,?)',(d['nome'],d.get('descricao','')))
    return jsonify({'sucesso':True,'id':cid})

@app.route('/api/movimentacoes')
@login_required
def api_movs():
    tipo,pid=request.args.get('tipo',''),request.args.get('produto_id','')
    sql='SELECT m.*,p.nome pnome,p.codigo pcod,u.nome unome FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id JOIN usuarios u ON u.id=m.usuario_id WHERE 1=1'
    args=[]
    if tipo: sql+=' AND m.tipo=?'; args.append(tipo)
    if pid: sql+=' AND m.produto_id=?'; args.append(pid)
    sql+=' ORDER BY m.data DESC LIMIT 200'
    rows=query(sql,args)
    return jsonify([{'id':r['id'],'tipo':r['tipo'],'produto':r['pnome'],'produto_id':r['produto_id'],'codigo':r['pcod'],
        'quantidade':r['quantidade'],'preco_unitario':r['preco_unitario'],'total':r['quantidade']*r['preco_unitario'],
        'motivo':r['motivo'] or '','nota_fiscal':r['nota_fiscal'] or '','data':r['data'][:16].replace('T',' '),'usuario':r['unome']} for r in rows])

@app.route('/api/movimentacoes',methods=['POST'])
@login_required
def api_criar_mov():
    d=request.json
    p=query('SELECT * FROM produtos WHERE id=?',(d['produto_id'],),one=True)
    if not p: return jsonify({'erro':'Produto nao encontrado'}),404
    qtd=float(d['quantidade']); tipo=d['tipo']
    if tipo=='SAIDA' and p['estoque_atual']<qtd:
        return jsonify({'erro':f"Estoque insuficiente. Disponivel: {p['estoque_atual']}"}),400
    execute('INSERT INTO movimentacoes(tipo,quantidade,preco_unitario,motivo,nota_fiscal,produto_id,usuario_id) VALUES(?,?,?,?,?,?,?)',
        (tipo,qtd,float(d.get('preco_unitario',p['preco_custo'])),d.get('motivo',''),d.get('nota_fiscal',''),p['id'],session['uid']))
    novo = p['estoque_atual']+qtd if tipo=='ENTRADA' else (p['estoque_atual']-qtd if tipo=='SAIDA' else qtd)
    execute('UPDATE produtos SET estoque_atual=? WHERE id=?',(novo,p['id']))
    return jsonify({'sucesso':True,'estoque_atual':novo})

@app.route('/api/usuarios')
@admin_required
def api_usuarios():
    rows=query('SELECT * FROM usuarios ORDER BY nome')
    return jsonify([{'id':r['id'],'nome':r['nome'],'email':r['email'],'perfil':r['perfil'],'ativo':bool(r['ativo']),
        'criado_em':(r['criado_em'] or '')[:10].replace('-','/'),
        'ultimo_login':(r['ultimo_login'] or '')[:16].replace('T',' ') or 'Nunca'} for r in rows])

@app.route('/api/usuarios/<int:uid>',methods=['PUT'])
@admin_required
def api_editar_user(uid):
    d=request.json
    if d.get('senha'):
        execute('UPDATE usuarios SET nome=?,perfil=?,ativo=?,senha_hash=? WHERE id=?',
            (d['nome'],d['perfil'],1 if d['ativo'] else 0,hash_pw(d['senha']),uid))
    else:
        execute('UPDATE usuarios SET nome=?,perfil=?,ativo=? WHERE id=?',
            (d['nome'],d['perfil'],1 if d['ativo'] else 0,uid))
    return jsonify({'sucesso':True})

@app.route('/api/relatorios/estoque')
@login_required
def rel_estoque():
    rows=query('SELECT p.*,c.nome cnome FROM produtos p LEFT JOIN categorias c ON c.id=p.categoria_id WHERE p.ativo=1 ORDER BY p.nome')
    return jsonify([{'codigo':r['codigo'],'nome':r['nome'],'categoria':r['cnome'] or '-','unidade':r['unidade'],
        'estoque_atual':r['estoque_atual'],'estoque_minimo':r['estoque_minimo'],'preco_custo':r['preco_custo'],
        'preco_venda':r['preco_venda'],'valor_estoque':round(r['estoque_atual']*r['preco_custo'],2),
        'status':'CRITICO' if r['estoque_atual']==0 else ('BAIXO' if r['estoque_atual']<=r['estoque_minimo'] else 'OK')} for r in rows])

@app.route('/api/relatorios/movimentacoes')
@login_required
def rel_movs():
    ini,fim=request.args.get('data_ini',''),request.args.get('data_fim','')
    sql='SELECT m.*,p.nome pnome,p.codigo pcod,u.nome unome FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id JOIN usuarios u ON u.id=m.usuario_id WHERE 1=1'
    args=[]
    if ini: sql+=' AND date(m.data)>=?'; args.append(ini)
    if fim: sql+=' AND date(m.data)<=?'; args.append(fim)
    sql+=' ORDER BY m.data DESC'
    rows=query(sql,args)
    return jsonify([{'data':r['data'][:16].replace('T',' '),'tipo':r['tipo'],'produto':r['pnome'],'codigo':r['pcod'],
        'quantidade':r['quantidade'],'preco_unitario':r['preco_unitario'],'total':round(r['quantidade']*r['preco_unitario'],2),
        'usuario':r['unome'],'nota_fiscal':r['nota_fiscal'] or ''} for r in rows])

if __name__=='__main__':
    init_db()
    app.run(debug=True, port=5000)
