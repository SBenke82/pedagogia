// =============================================================
// aparencia.js
// Tema, cor, logo da escola, modo escuro
// Nome e logo agora ficam no Firestore (config/aparencia)
// =============================================================

import { db } from './config.js';
import { el, enviarImgBB } from './utils.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =============================================================
// MODO ESCURO
// =============================================================
export function aplicarModoEscuro(escuro) {
    document.body.classList.toggle('modo-escuro', escuro);
    const btn = el('btnModo');
    if (btn) btn.textContent = escuro ? '☀️' : '🌙';
    localStorage.setItem('modoEscuro', escuro ? '1' : '0');
}

window.alternarModoEscuro = function() {
    aplicarModoEscuro(!document.body.classList.contains('modo-escuro'));
};

// =============================================================
// LOGO E MARCA D'ÁGUA
// =============================================================
export function aplicarLogo(url) {
    const logo = el('logoEscola');
    const marca = el('marcaDagua');
    if (logo) {
        logo.src = url;
        logo.style.display = 'block';
    }
    if (marca) {
        marca.style.backgroundImage = `url('${url}')`;
        marca.style.display = 'block';
    }
}

export function aplicarNomeEscola(nome) {
    const elNome = el('nomeEscola');
    const elInput = el('inputNomeEscola');
    if (elNome) elNome.innerText = nome;
    if (elInput) elInput.value = nome;
}

// =============================================================
// CARREGAR APARÊNCIA (localStorage — rápido)
// =============================================================
export function carregarAparencia() {
    const nomeEscola = localStorage.getItem('nomeEscola');
    const logoUrl = localStorage.getItem('logoUrl');
    const tema = localStorage.getItem('tema');
    const modoEscuro = localStorage.getItem('modoEscuro') === '1';

    if (nomeEscola) aplicarNomeEscola(nomeEscola);
    if (logoUrl) aplicarLogo(logoUrl);

    if (tema && tema !== 'azul') {
        document.body.className = 'tema-' + tema +
            (document.body.classList.contains('modo-escuro') ? ' modo-escuro' : '');
        document.querySelectorAll('.cor-opcao').forEach(c => {
            c.classList.toggle('selecionada', c.dataset.tema === tema);
        });
    } else {
        const e = document.querySelector('.cor-opcao[data-tema="azul"]');
        if (e) e.classList.add('selecionada');
    }

    aplicarModoEscuro(modoEscuro);
}

// =============================================================
// CARREGAR APARÊNCIA DO FIRESTORE (ao logar)
// Sobrescreve o localStorage se o Firestore tiver dados mais novos
// =============================================================
export async function carregarAparenciaDoFirestore() {
    try {
        const ref = doc(db, "config", "aparencia");
        const snap = await getDoc(ref);
        if (!snap.exists()) return; // nada salvo ainda, mantém localStorage

        const d = snap.data();

        if (d.nomeEscola) {
            localStorage.setItem('nomeEscola', d.nomeEscola);
            aplicarNomeEscola(d.nomeEscola);
        }
        if (d.logoUrl) {
            localStorage.setItem('logoUrl', d.logoUrl);
            aplicarLogo(d.logoUrl);
        }
    } catch (e) {
        console.warn("Não foi possível carregar aparência do Firestore:", e);
    }
}

// =============================================================
// TROCAR TEMA (cor principal)
// =============================================================
window.trocarTema = function(tema, elemento) {
    const temModoEscuro = document.body.classList.contains('modo-escuro');
    document.body.className = (tema === 'azul' ? '' : 'tema-' + tema) +
        (temModoEscuro ? ' modo-escuro' : '');
    document.querySelectorAll('.cor-opcao').forEach(c => c.classList.remove('selecionada'));
    if (elemento) elemento.classList.add('selecionada');
    localStorage.setItem('tema', tema);
};

// =============================================================
// SALVAR NOME DA ESCOLA + LOGO (localStorage + Firestore)
// =============================================================
window.salvarAparencia = async function() {
    const nome = el('inputNomeEscola').value.trim();
    const inputLogo = el('inputLogo');

    let novoLogoUrl = null;

    // Se mudou o nome, salva no localStorage e na tela já
    if (nome) {
        localStorage.setItem('nomeEscola', nome);
        aplicarNomeEscola(nome);
    }

    // Se escolheu logo, envia pro imgBB
    if (inputLogo.files.length > 0) {
        try {
            novoLogoUrl = await enviarImgBB(inputLogo.files[0]);
            localStorage.setItem('logoUrl', novoLogoUrl);
            aplicarLogo(novoLogoUrl);
            inputLogo.value = "";
        } catch (e) {
            alert("Erro ao enviar logo: " + e.message);
            return;
        }
    }

    // Salva tudo no Firestore
    try {
        const dados = {
            atualizadoEm: new Date().toISOString()
        };
        if (nome) dados.nomeEscola = nome;
        if (novoLogoUrl) dados.logoUrl = novoLogoUrl;

        // Só grava se tem pelo menos uma coisa
        if (Object.keys(dados).length > 1) {
            await setDoc(doc(db, "config", "aparencia"), dados, { merge: true });
            alert("✅ Aparência salva no servidor!");
        } else {
            alert("Nada para salvar (nome e logo vazios).");
        }
    } catch (e) {
        alert("Erro ao salvar no servidor: " + e.message +
              "\n\nMas foi salvo no seu navegador local.");
    }
};