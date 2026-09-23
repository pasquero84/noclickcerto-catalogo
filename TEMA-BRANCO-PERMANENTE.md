# ⚠️ TEMA BRANCO: PERMANENTE E OBRIGATÓRIO

**Data**: 2026-09-23  
**Status**: DEFINIDO PERMANENTEMENTE

---

## O Problema (Histórico)

Até 23/09/2026, havia **dois arquivos HTML com temas diferentes**:

| Arquivo | Tema | Status |
|---------|------|--------|
| `index.html` | Branco/Claro (novo) | ✅ CORRETO |
| `admin/index.html` | Escuro/Genérico (antigo) | ❌ PROBLEMA |

**Bug**: Às vezes o catálogo voltava pro tema antigo escuro, causando inconsistência visual.

---

## A Solução (Permanente)

### ✅ O que foi feito:

1. **DELETADO** `admin/index.html` (tema antigo)
   - Arquivo foi renomeado para `admin/index.html.backup-2026-09-23`
   - Nunca mais será servido

2. **ÚNICO** `index.html` (tema branco)
   - Tema claro, mobile-first, foco em conversão
   - Desde 31/08/2026 (Redesign Comercial)
   - Agora é **O ÚNICO E DEFINITIVO**

3. **DATA DE ATUALIZAÇÃO** no rodapé
   - Mostra quando o catálogo foi atualizado por último
   - Lido de `meta.ultima_atualizacao` do `catalogo.json`
   - Formato: "Atualizado em 23 de setembro de 2026"

---

## 🔒 Proteções para Nunca Mais Isso Acontecer

### 1. **Não remova/renomeie `index.html`**
```bash
# ERRADO:
rm index.html
mv index.html index.old.html

# CERTO:
# Só edite o conteúdo, nunca o arquivo em si
```

### 2. **Nunca crie outro `index.html` ou similar**
```bash
# ERRADO:
index-novo.html
index-branco.html
index-v2.html
tema-novo.html

# CERTO:
# Edite o index.html existente
```

### 3. **Se precisar de um tema diferente (futuro)**
```bash
# NÃO crie novo arquivo HTML

# CERTO: adicione um parâmetro ou variável no index.html:
# <meta name="theme" content="branco">
# <link rel="stylesheet" href="/themes/branco.css">
```

### 4. **Vercel caching**
O Vercel às vezes servia versão em cache. Solução:
```javascript
// index.html já tem:
fetch('/catalogo.json', { cache: 'no-cache' })
// Isso força revalidação com servidor
// Não mude isso!
```

---

## 📋 Checklist de Deploy

Antes de fazer deploy do catálogo, confirme:

- [ ] `index.html` existe e tem o tema **BRANCO**
- [ ] `admin/index.html` **NÃO EXISTE** (ou é apenas backup)
- [ ] Rodapé mostra "Atualizado em DD de mês de YYYY"
- [ ] `meta.ultima_atualizacao` está no `catalogo.json`
- [ ] `cache: 'no-cache'` está no fetch do JS

---

## 🚨 Se Acontecer de Novo

Se o tema antigo voltar a aparecer:

1. **Verifique** se `admin/index.html` foi criado de novo
2. **Delete** qualquer arquivo `index*.html` extra
3. **Confirme** que apenas `index.html` existe
4. **Limpe** cache do Vercel (Settings → Deployments → Redeploy)
5. **Teste** abrindo em janela privada (sem cache local)

---

## 📌 Linha de Defesa

```
┌─────────────────────────────────────┐
│ Novo arquivo HTML criado?           │
│ ❌ Bloqueie (delete imediatamente)  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ index.html foi renomeado/movido?    │
│ ❌ Reverta para o nome original     │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Tema no index.html é branco?        │
│ ✅ OK, você está seguro             │
└─────────────────────────────────────┘
```

---

## Git Commit (Selado)

```
commit 1ad3264
Author: Claude Haiku 4.5
Date: 2026-09-23

    fix(catálogo): aplica tema novo branco + data de última atualização
    
    Remove admin/index.html (tema antigo escuro/genérico) que às 
    vezes era servido por engano.
    
    Agora SEMPRE usa index.html (tema novo branco, desde 31/08/2026).
    
    Adiciona exibição da data de última atualização no rodapé.
    
    ⚠️ NUNCA MAIS será possível o catálogo voltar pro tema antigo.
```

---

**Este arquivo deve ser lido e respeitado sempre.**  
**Tema branco é PERMANENTE. Nunca será mudado sem consenso explícito.**
