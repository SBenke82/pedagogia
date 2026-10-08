// =============================================================
// auth.js
// Login, logout, sessão e verificação de senha pendente
// =============================================================

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updatePassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db, estado } from './config.js';
import { el, erroAuth } from './utils.js';

// =============================================================
// LOGIN
// =============================================================
window.fazerLogin = async function() {
    const email = el('email').value.trim().toLowerCase();
    const senha = el('senha').value;
    el('msgErroLogin').innerText = "";
    try {
        await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
        el('msgErroLogin').innerText = erroAuth(error);
    }
};

// Enter nos campos de login
['email', 'senha'].forEach(id => {
    const campo = el(id);
    if (campo) {
        campo.addEventListener('keydown', e => {
            if (e.key === 'Enter') window.fazerLogin();
        });
    }
});

// =============================================================
// LOGOUT
// =============================================================
window.fazerLogout = async function() {
    if (estado.fichaTemAlteracoes && !el('telaFichaAluno').classList.contains('hidden')) {
        if (!confirm("⚠️ Você tem alterações não salvas na ficha do aluno.\n\nDeseja realmente sair sem salvar?")) return;
    }
    if (confirm("Deseja realmente sair do sistema?")) {
        await signOut(auth);
    }
};

// =============================================================
// SENHA PENDENTE (definida pelo diretor)
// =============================================================
window.definirNovaSenhaObrigatoria = async function() {
    const s1 = el('novaSenhaObrigatoria1').value;
    const s2 = el('novaSenhaObrigatoria2').value;
    if (!s1 || s1.length < 6) { alert("Senha mínima de 6 caracteres."); return; }
    if (s1 !== s2) { alert("As senhas não coincidem."); return; }
    try {
        await updatePassword(estado.usuarioLogado, s1);
        const email = (estado.usuarioLogado.email || '').toLowerCase();
        await updateDoc(doc(db, "usuarios_sistema", email), {
            senhaPendente: null,
            dataTrocaSenha: new Date().toISOString()
        });
        el('modalTrocarSenhaPendente').classList.add('hidden');
        alert("✅ Nova senha definida com sucesso!");
        window.location.reload();
    } catch (e) {
        alert("Erro: " + erroAuth(e));
    }
};

// =============================================================
// VERIFICAR USUÁRIO NO FIRESTORE (ativo/bloqueado/removido)
// =============================================================
async function verificarUsuarioESenha(user) {
    const email = (user.email || '').toLowerCase();
    try {
        const ref = doc(db, "usuarios_sistema", email);
        const snap = await getDoc(ref);

        // Se não existe, cria um registro de diretor (primeiro acesso)
        if (!snap.exists()) {
            await setDoc(ref, {
                email,
                nome: email.split('@')[0],
                cargo: 'diretor',
                status: 'ativo',
                criadoEm: new Date().toISOString(),
                ultimoLogin: new Date().toISOString()
            });
            return { ativo: true, cargo: 'diretor', senhaPendente: false };
        }

        const d = snap.data();
        let cargo = d.cargo || 'diretor';

        if (d.status === 'bloqueado') {
            return { ativo: false, mensagem: "🚫 Acesso bloqueado. Contate o administrador." };
        }
        if (d.status === 'removido') {
            return { ativo: false, mensagem: "🚫 Este acesso foi removido." };
        }

        await updateDoc(ref, { ultimoLogin: new Date().toISOString() });
        return {
            ativo: true,
            cargo,
            senhaPendente: !!d.senhaPendente
        };
    } catch (e) {
        console.error(e);
        return { ativo: true, cargo: 'pedagogo', senhaPendente: false };
    }
}

// =============================================================
// OBSERVAR ESTADO DE AUTENTICAÇÃO
// =============================================================
export function iniciarAuth() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const info = await verificarUsuarioESenha(user);

            if (!info.ativo) {
                estado.msgLoginPendente = info.mensagem;
                await signOut(auth);
                return;
            }

            estado.usuarioLogado = user;
            estado.usuarioCargo = info.cargo;

            // Se há senha pendente, obriga troca antes de entrar
            if (info.senhaPendente) {
                el('telaLogin').classList.add('hidden');
                el('appPrincipal').classList.add('hidden');
                el('modalTrocarSenhaPendente').classList.remove('hidden');
                return;
            }

            // Entra no app
            el('telaLogin').classList.add('hidden');
            el('appPrincipal').classList.remove('hidden');
            el('usuarioLogadoEmail').innerText = user.email;
            el('usuarioLogadoCargo').innerHTML = estado.usuarioCargo === 'diretor'
                ? '<span class="badge-cargo diretor">👑 Diretor</span>'
                : '<span class="badge-cargo pedagogo">👤 Pedagogo</span>';

            // Mostra/oculta abas de configuração conforme o cargo
            ['btnConfigUsuario', 'btnConfigAparencia', 'btnConfigBackup'].forEach(id => {
                el(id).classList.toggle('hidden', estado.usuarioCargo !== 'diretor');
            });

            // Volta para a tela de turmas
            estado.telaAntesConfig = 'telaTurmas';
            ['telaConfig', 'telaTurmaDetalhe', 'telaFichaAluno'].forEach(i => el(i).classList.add('hidden'));
            el('telaTurmas').classList.remove('hidden');
            estado.fichaTemAlteracoes = false;

            // Carrega os dados iniciais (funções expostas por outros módulos no window)
            if (typeof window.carregarTurmas === 'function') window.carregarTurmas();
            if (typeof window.carregarTodosOsAlunos === 'function') window.carregarTodosOsAlunos();
            if (estado.usuarioCargo === 'diretor' && typeof window.carregarUsuarios === 'function') {
                window.carregarUsuarios();
            }
        } else {
            // Deslogado
            estado.usuarioLogado = null;
            estado.usuarioCargo = 'pedagogo';
            estado.todosOsAlunosCache = [];
            estado.todasAsTurmasCache = [];

            el('telaLogin').classList.remove('hidden');
            el('appPrincipal').classList.add('hidden');
            el('modalTrocarSenhaPendente').classList.add('hidden');
            el('senha').value = "";
            el('msgErroLogin').innerText = estado.msgLoginPendente;
            estado.msgLoginPendente = "";
            estado.fichaTemAlteracoes = false;
        }
    });
}