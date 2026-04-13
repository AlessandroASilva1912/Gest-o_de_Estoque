"""
Script para popular o banco com dados de demonstração.
Execute: python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db, Usuario, Fornecedor, Categoria, Produto, Movimentacao
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import random

with app.app_context():
    db.create_all()

    # Usuário admin
    if not Usuario.query.filter_by(email='admin@stockpro.com').first():
        db.session.add(Usuario(nome='Administrador', email='admin@stockpro.com',
            senha_hash=generate_password_hash('admin123'), perfil='admin'))
        db.session.add(Usuario(nome='Gerente Estoque', email='gerente@stockpro.com',
            senha_hash=generate_password_hash('gerente123'), perfil='gerente'))
        db.session.add(Usuario(nome='Operador', email='operador@stockpro.com',
            senha_hash=generate_password_hash('operador123'), perfil='operador'))
        print("✅ Usuários criados")

    # Categorias
    cats = {'Eletrônicos': 1, 'Papelaria': 2, 'Limpeza': 3, 'Ferramentas': 4, 'Informática': 5, 'Alimentação': 6}
    for nome in cats:
        if not Categoria.query.filter_by(nome=nome).first():
            db.session.add(Categoria(nome=nome, descricao=f'Produtos da categoria {nome}'))
    db.session.commit()
    print("✅ Categorias criadas")

    # Fornecedores
    forns_data = [
        ('TechSupply Ltda', '12.345.678/0001-90', 'contato@techsupply.com', '(11) 9999-0001', 'São Paulo', 'SP'),
        ('Distribuidora Central', '98.765.432/0001-10', 'vendas@distcentral.com', '(21) 8888-0002', 'Rio de Janeiro', 'RJ'),
        ('ForneBrasil ME', '11.222.333/0001-44', 'forne@fornebrasil.com', '(31) 7777-0003', 'Belo Horizonte', 'MG'),
    ]
    forns = []
    for nome, cnpj, email, tel, cidade, estado in forns_data:
        f = Fornecedor.query.filter_by(cnpj=cnpj).first()
        if not f:
            f = Fornecedor(nome=nome, cnpj=cnpj, email=email, telefone=tel, cidade=cidade, estado=estado)
            db.session.add(f)
    db.session.commit()
    print("✅ Fornecedores criados")
    forns = Fornecedor.query.all()
    cats_obj = Categoria.query.all()
    cat_map = {c.nome: c.id for c in cats_obj}

    # Produtos
    produtos_data = [
        ('EL-001','Notebook Dell Inspiron','Eletrônicos',1800,2500,15,3,50,forns[0]),
        ('EL-002','Monitor LG 24"','Eletrônicos',450,700,8,5,30,forns[0]),
        ('EL-003','Smartphone Samsung A54','Eletrônicos',1100,1600,20,5,60,forns[0]),
        ('IN-001','Mouse sem fio Logitech','Informática',45,90,50,10,200,forns[0]),
        ('IN-002','Teclado USB ABNT2','Informática',35,70,2,10,150,forns[1]),
        ('IN-003','Cabo HDMI 2m','Informática',12,25,100,20,300,forns[1]),
        ('PA-001','Resma de Papel A4','Papelaria',18,30,30,15,200,forns[1]),
        ('PA-002','Caneta Azul BIC (cx50)','Papelaria',22,40,5,10,100,forns[1]),
        ('PA-003','Grampeador 26/6','Papelaria',15,28,25,8,80,forns[2]),
        ('LI-001','Detergente 500ml','Limpeza',3,7,80,30,500,forns[2]),
        ('LI-002','Álcool 70% 1L','Limpeza',8,15,0,20,200,forns[2]),
        ('FE-001','Chave de Fenda Ph2','Ferramentas',8,18,12,5,60,forns[2]),
        ('FE-002','Furadeira Black&Decker','Ferramentas',180,320,4,3,20,forns[0]),
        ('AL-001','Café em pó 500g','Alimentação',14,22,45,20,150,forns[1]),
        ('AL-002','Açúcar cristal 1kg','Alimentação',4,7,60,25,200,forns[1]),
    ]
    admin = Usuario.query.first()
    for codigo, nome, cat_nome, custo, venda, atual, minimo, maximo, forn in produtos_data:
        if not Produto.query.filter_by(codigo=codigo).first():
            p = Produto(
                codigo=codigo, nome=nome, unidade='UN',
                preco_custo=custo, preco_venda=venda,
                estoque_atual=atual, estoque_minimo=minimo, estoque_maximo=maximo,
                categoria_id=cat_map.get(cat_nome), fornecedor_id=forn.id
            )
            db.session.add(p)
            db.session.flush()
            if atual > 0:
                db.session.add(Movimentacao(tipo='ENTRADA', quantidade=atual, preco_unitario=custo,
                    motivo='Estoque inicial (seed)', produto_id=p.id, usuario_id=admin.id))
    db.session.commit()
    print("✅ Produtos criados")

    # Movimentações extras
    prods = Produto.query.all()
    for i in range(30):
        p = random.choice(prods)
        tipo = random.choice(['ENTRADA','ENTRADA','SAIDA'])
        qty = random.randint(1, 10)
        if tipo == 'SAIDA' and p.estoque_atual < qty:
            continue
        mov = Movimentacao(
            tipo=tipo, quantidade=qty, preco_unitario=p.preco_custo if tipo=='ENTRADA' else p.preco_venda,
            motivo='Movimentação de demonstração',
            data=datetime.utcnow() - timedelta(days=random.randint(0,7), hours=random.randint(0,23)),
            produto_id=p.id, usuario_id=admin.id
        )
        if tipo == 'ENTRADA': p.estoque_atual += qty
        else: p.estoque_atual -= qty
        db.session.add(mov)
    db.session.commit()
    print("✅ Movimentações de demo criadas")
    print("\n🎉 Banco populado com sucesso!")
    print("   Admin: admin@stockpro.com / admin123")
    print("   Gerente: gerente@stockpro.com / gerente123")
    print("   Operador: operador@stockpro.com / operador123")
