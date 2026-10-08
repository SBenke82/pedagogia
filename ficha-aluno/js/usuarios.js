// =============================================================
// usuarios.js
// CRUD de usuários do sistema (somente Diretor)
// =============================================================

import {
    getAuth,
    createUserWithEmailAndPassword,
    signOut,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, getDocs, doc, getDoc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { db, estado } from './config.js';
import { el, esc, erroAuth, dataHoraFormatada } from './utils.js';

// Reutiliza a config do Firebase para criar app secundário
const firebaseConfig = {
    apiKey: "AIzaSyAUaZb_dbg5g4hpdwLG2pq1myGWIAUN6pQ",
    authDomain: "fichaaluno-4732f.firebaseapp.com",
    projectId: "fichaaluno-4732f",
    storageBucket: "fichaaluno-4732f.firebasestorage.app",
    messagingSenderId: "543372325334",
    appId: "1:543372325334:web:2f9851e40fe8fc19f1b477"
};

const ehDiretor = () => estado.usuarioCargo === 'diretor';
const ehVoce = (email) => estado.usuarioLogado && email === (estado.usuarioLogado.email || '').toLowerCase();

// =============================================================
// MOSTRAR/ESCONDER SENHA
// =============================================================
window.alternarVerSenha = function(id, btn) {
    const input = el(id);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
};

// =============================================================
// CRIAR NOVO USUÁRIO
// =============================================================
window.adicionarUsuario = async function() {
    if (!ehDiretor()) { alert("Apenas o Diretor pode cadastrar usuários."); return; }

    const email = el('novoUsuarioEmail').value.trim().toLowerCase();
    const nome = el('novoUsuarioNome').value.trim();
    const cargo = el('novoUsuarioCargo').value;
    const senha = el('novoUsuarioSenha').value;
    const senha2 = el('novoUsuarioSenha2').value;

    if (!email || !senha) { alert("Preencha e-mail e senha."); return; }
    if (!nome) { alert("Preencha o nome de exibição."); return; }
    if (senha.length < 6) { alert("Senha mínima de 6 caracteres."); return; }
    if (senha !== senha2) { alert("As senhas não coincidem."); return; }

    let appSec = null;
    try {
        // Cria app secundário temporário (não desloga o usuário atual)
        appSec = initializeApp(firebaseConfig, "Secundario" + Date.now());
        const authSec = getAuth(appSec);
        await createUserWithEmailAndPassword(authSec, email, senha);
        await signOut(authSec);

        // Registra no Firestore
        await setDoc(doc(db, "usuarios_sistema", email), {
            email, nome, cargo, status: 'ativo',
            criadoEm: new Date().toISOString(),
            criadoPor: estado.usuarioLogado.email,
            ultimoLogin: null
        });

        alert(`✅ Usuário criado!\n\n📧 E-mail: ${email}\n🔑 Senha: ${senha}\n👤 Cargo: ${cargo === 'diretor' ? 'Diretor' : 'Pedagogo'}\n\nRepasse esses dados.`);

        ['novoUsuarioEmail', 'novoUsuarioNome', 'novoUsuarioSenha', 'novoUsuarioSenha2']
            .forEach(i => el(i).value = "");
        el('novoUsuarioCargo').value = 'pedagogo';
        carregarUsuarios();
    } catch (error) {
        alert("Erro ao criar usuário: " + erroAuth(error));
    }
};

// =============================================================
// LISTAR USUÁRIOS
// =============================================================
export async function carregarUsuarios() {
    if (!ehDiretor()) return;
    const lista = el('listaUsuarios');
    lista.innerHTML = '<p style="color:var(--cor-texto-suave);font-size:13px;">Carregando...</p>';

    try {
        const snap = await getDocs(collection(db, "usuarios_sistema"));
        lista.innerHTML = "";
        let qtd = 0;

        snap.forEach(docSnap => {
            const user = docSnap.data();
            if (user.status === 'removido') return;
            qtd++;

            const email = docSnap.id;
            const isVoce = ehVoce(email);
            const isBloqueado = user.status === 'bloqueado';
            const isSenhaPendente = !!user.senhaPendente;
            const nomeExibir = user.nome || email.split('@')[0];
            const cargo = user.cargo || 'pedagogo';

            const badgeCargo = cargo === 'diretor'
                ? '<span class="badge-cargo diretor">👑 Diretor</span>'
                : '<span class="badge-cargo pedagogo">👤 Pedagogo</span>';

            let statusTxt = isBloqueado ? '🚫 Bloqueado' : '✅ Ativo';
            if (isSenhaPendente && !isBloqueado) statusTxt = '🔐 Senha pendente';

            const ultimoLoginTxt = user.ultimoLogin
                ? 'Último acesso: ' + dataHoraFormatada(user.ultimoLogin)
                : 'Nunca acessou';

            const e = esc(email);
            const item = document.createElement('div');
            item.className = 'usuario-item' + (isBloqueado && !isVoce ? ' bloqueado' : '');
            item.innerHTML = `
                <div class="info">
                    <div class="email">${e} ${isVoce ? '<span style="color:var(--cor-primaria);">(você)</span>' : ''}</div>
                    <div class="nome">${esc(nomeExibir)} ${badgeCargo}</div>
                    <div class="status ${isBloqueado ? 'bloqueado' : ''}">${statusTxt}</div>
                    <div class="status">${ultimoLoginTxt}</div>
                </div>
                <div class="acoes">
                    <button class="btn-editar" data-email="${e}" style="background:var(--cor-primaria);">⚙️ Gerenciar</button>
                </div>`;
            lista.appendChild(item);
        });

        if (qtd === 0) {
            lista.innerHTML = '<p style="color:var(--cor-texto-suave);font-size:13px;">Nenhum usuário cadastrado ainda.</p>';
            return;
        }

        lista.querySelectorAll('.btn-editar').forEach(b => {
            b.onclick = function() { abrirModalGerenciarUsuario(this.dataset.email); };
        });
    } catch (e) {
        lista.innerHTML = '<p style="color:var(--cor-perigo);font-size:13px;">Erro ao carregar usuários.</p>';
        console.error(e);
    }
}

// =============================================================
// MODAL DE GERENCIAMENTO
// =============================================================
window.abrirModalGerenciarUsuario = async function(email) {
    if (!ehDiretor()) return;
    try {
        const snap = await getDoc(doc(db, "usuarios_sistema", email));
        if (!snap.exists()) { alert("Usuário não encontrado."); return; }

        const u = snap.data();
        estado.emailAlvoModal = email;

        const isVoce = ehVoce(email);
        const isBloqueado = u.status === 'bloqueado';
        const cargo = u.cargo || 'pedagogo';
        const badgeCargo = cargo === 'diretor'
            ? '<span class="badge-cargo diretor">👑 Diretor</span>'
            : '<span class="badge-cargo pedagogo">👤 Pedagogo</span>';
        const ultimoLoginTxt = u.ultimoLogin ? dataHoraFormatada(u.ultimoLogin) : 'Nunca acessou';

        const box = el('modalGerenciarUsuarioBox');
        box.innerHTML = `
            <h3>⚙️ Gerenciar Usuário</h3>
            <div class="info-usuario-modal">
                <div><strong>📧 E-mail:</strong> ${esc(email)}</div>
                <div><strong>👤 Nome:</strong> ${esc(u.nome || '-')}</div>
                <div><strong>🎫 Cargo:</strong> ${badgeCargo}</div>
                <div><strong>📊 Status:</strong> ${isBloqueado ? '🚫 Bloqueado' : '✅ Ativo'}</div>
                <div><strong>🕒 Último acesso:</strong> ${ultimoLoginTxt}</div>
            </div>
            <div class="grupo-acoes">
                <button class="acao-editar" onclick="abrirEditarNome()">✏️ Trocar Nome</button>
                ${!isVoce ? `<button class="acao-senha" onclick="abrirTrocarSenhaOutro()">🔑 Trocar Senha</button>` : ''}
                ${!isVoce ? `<button class="acao-cargo" onclick="abrirTrocarCargo()">🎫 Trocar Cargo (atual: ${cargo === 'diretor' ? 'Diretor' : 'Pedagogo'})</button>` : ''}
                ${!isVoce ? (isBloqueado
                    ? `<button class="acao-desbloquear" onclick="desbloquearUsuario('${esc(email)}')">🔓 Desbloquear</button>`
                    : `<button class="acao-bloquear" onclick="bloquearUsuario('${esc(email)}')">🔒 Bloquear</button>`) : ''}
                ${!isVoce ? `<button class="acao-excluir" onclick="excluirUsuario('${esc(email)}')">🗑️ Excluir do Sistema</button>` : ''}
            </div>
            <div style="text-align:right;margin-top:20px;">
                <button class="btn-cancelar-modal" onclick="fecharModalGerenciarUsuario()">Fechar</button>
            </div>
        `;
        el('modalGerenciarUsuario').classList.remove('hidden');
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

window.fecharModalGerenciarUsuario = function() {
    el('modalGerenciarUsuario').classList.add('hidden');
    estado.emailAlvoModal = null;
};

// =============================================================
// TROCAR NOME
// =============================================================
window.abrirEditarNome = async function() {
    const snap = await getDoc(doc(db, "usuarios_sistema", estado.emailAlvoModal));
    const nomeAtual = snap.exists() ? (snap.data().nome || '') : '';
    const novo = prompt("Digite o novo nome de exibição:", nomeAtual);
    if (novo === null) return;
    if (!novo.trim()) { alert("Nome não pode ser vazio."); return; }
    try {
        await updateDoc(doc(db, "usuarios_sistema", estado.emailAlvoModal), { nome: novo.trim() });
        alert("✅ Nome atualizado!");
        fecharModalGerenciarUsuario();
        carregarUsuarios();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// TROCAR CARGO
// =============================================================
window.abrirTrocarCargo = async function() {
    const snap = await getDoc(doc(db, "usuarios_sistema", estado.emailAlvoModal));
    const cargoAtual = snap.exists() ? (snap.data().cargo || 'pedagogo') : 'pedagogo';
    const novoCargo = cargoAtual === 'diretor' ? 'pedagogo' : 'diretor';

    if (!confirm(`Trocar o cargo deste usuário para "${novoCargo === 'diretor' ? 'Diretor' : 'Pedagogo'}"?`)) return;

    try {
        await updateDoc(doc(db, "usuarios_sistema", estado.emailAlvoModal), { cargo: novoCargo });
        alert("✅ Cargo atualizado!");
        fecharModalGerenciarUsuario();
        carregarUsuarios();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// SENHA PENDENTE (diretor define, usuário troca no próximo login)
// =============================================================
window.abrirTrocarSenhaOutro = function() {
    el('senhaPendente1').value = "";
    el('senhaPendente2').value = "";
    el('modalTrocarSenhaOutro').classList.remove('hidden');
};

window.fecharModalSenhaPendente = function() {
    el('modalTrocarSenhaOutro').classList.add('hidden');
};

window.salvarSenhaPendente = async function() {
    const s1 = el('senhaPendente1').value;
    const s2 = el('senhaPendente2').value;
    if (!s1 || s1.length < 6) { alert("Senha mínima de 6 caracteres."); return; }
    if (s1 !== s2) { alert("As senhas não coincidem."); return; }

    try {
        await updateDoc(doc(db, "usuarios_sistema", estado.emailAlvoModal), { senhaPendente: s1 });
        alert(`✅ Senha pendente definida!\n\n📧 Usuário: ${estado.emailAlvoModal}\n🔑 Senha temporária: ${s1}`);
        fecharModalSenhaPendente();
        fecharModalGerenciarUsuario();
        carregarUsuarios();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// BLOQUEAR / DESBLOQUEAR / EXCLUIR
// =============================================================
window.bloquearUsuario = async function(email) {
    if (ehVoce(email)) { alert("🚫 Você não pode bloquear o seu próprio cadastro!"); return; }
    if (!confirm(`Bloquear o acesso de ${email}?`)) return;
    try {
        await updateDoc(doc(db, "usuarios_sistema", email), { status: 'bloqueado' });
        alert("✅ Usuário bloqueado!");
        fecharModalGerenciarUsuario();
        carregarUsuarios();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

window.desbloquearUsuario = async function(email) {
    try {
        await updateDoc(doc(db, "usuarios_sistema", email), { status: 'ativo' });
        alert("✅ Usuário desbloqueado!");
        fecharModalGerenciarUsuario();
        carregarUsuarios();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

window.excluirUsuario = async function(email) {
    if (ehVoce(email)) { alert("🚫 Você não pode remover o seu próprio cadastro!"); return; }
    if (!confirm(`⚠️ Excluir o usuário "${email}" do sistema?\n\nEle será bloqueado permanentemente e removido da lista.`)) return;
    try {
        await updateDoc(doc(db, "usuarios_sistema", email), {
            status: 'removido',
            senhaPendente: null,
            removidoEm: new Date().toISOString(),
            removidoPor: estado.usuarioLogado.email
        });
        alert("✅ Usuário removido do sistema!");
        fecharModalGerenciarUsuario();
        carregarUsuarios();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// TROCAR A PRÓPRIA SENHA (aba "Senha" das configurações)
// =============================================================
window.trocarSenha = async function() {
    const s1 = el('novaSenha').value;
    const s2 = el('novaSenha2').value;
    if (!s1 || s1.length < 6) { alert("Senha mínima de 6 caracteres."); return; }
    if (s1 !== s2) { alert("As senhas não coincidem."); return; }
    try {
        await updatePassword(estado.usuarioLogado, s1);
        alert("✅ Senha alterada!");
        el('novaSenha').value = "";
        el('novaSenha2').value = "";
    } catch (error) {
        alert("Erro: " + erroAuth(error));
    }
};