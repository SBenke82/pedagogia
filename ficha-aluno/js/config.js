// =============================================================
// config.js
// Firebase + estado global + configurações de PDF/Impressão
// =============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---------- Firebase ----------
const firebaseConfig = {
    apiKey: "AIzaSyAUaZb_dbg5g4hpdwLG2pq1myGWIAUN6pQ",
    authDomain: "fichaaluno-4732f.firebaseapp.com",
    projectId: "fichaaluno-4732f",
    storageBucket: "fichaaluno-4732f.firebasestorage.app",
    messagingSenderId: "543372325334",
    appId: "1:543372325334:web:2f9851e40fe8fc19f1b477"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const IMGBB_API_KEY = "8e5cb04805ad3739698440c78fb16dd2";

// ---------- Estado global ----------
export const estado = {
    usuarioLogado: null,
    usuarioCargo: 'pedagogo',
    usuarioNome: '',
    turmaAtual: null,
    alunoAtualId: null,
    alunoAtual: null,
    ocorrenciasAtuais: [],
    anexosAtuais: [],
    relatoriosAtuais: [],
    todosOsAlunosCache: [],
    todasAsTurmasCache: [],
    telaAntesConfig: 'telaTurmas',
    msgLoginPendente: "",
    fichaTemAlteracoes: false,
    emailAlvoModal: null,
    urlFotoFull: null,
    ocIdComunicar: null,
    tipoRelatorioAtual: 'estudante',
    cacheFichasAluno: {}
};

// =============================================================
// CONFIGURAÇÕES DE PDF / IMPRESSÃO
// (persistidas em config/pdf no Firestore)
// =============================================================

export const CONFIG_PDF_PADRAO = {
    // ---------- RELATÓRIO COMPLETO (botão "📄 Exportar PDF") ----------
    relatorio_cabecalho_logo: true,
    relatorio_foto: false,
    relatorio_idade: true,
    relatorio_encaminhamentos: true,
    relatorio_observacoes: true,
    relatorio_estudo_caso: true,
    relatorio_anexos: false,
    relatorio_incluir_conselho: false,
    relatorio_incluir_ocorrencias: false,
    relatorio_incluir_relatorios_estudante: false,
    relatorio_incluir_relatorios_inclusao: false,
    relatorio_assinatura_pedagogo: true,
    relatorio_assinatura_professor: true,
    relatorio_assinatura_apoio: false,
    relatorio_assinatura_responsavel: true,
    relatorio_visto_direcao: false,
    relatorio_rodape_emissao: true,
    relatorio_numeracao_pagina: true,

    // ---------- IMPRESSÃO/PDF DE OCORRÊNCIAS (botão "🖨️") ----------
    ocorrencias_cabecalho_logo: true,
    ocorrencias_foto: false,
    ocorrencias_encaminhamentos: false,
    ocorrencias_observacoes: false,
    ocorrencias_estudo_caso: false,
    ocorrencias_anexos: false,
    ocorrencias_assinatura_pedagogo: false,
    ocorrencias_assinatura_professor: false,
    ocorrencias_assinatura_apoio: false,
    ocorrencias_assinatura_responsavel: true,
    ocorrencias_rodape_emissao: false,
    ocorrencias_numeracao_pagina: false,
    ocorrencias_filtro: 'todas', // todas | com_comunicado | sem_comunicado

    // ---------- COMPARTILHADO (estilo) ----------
    mostrar_somente_encaminhamentos: false,
    estilo_monocromatico: false,
    estilo_tamanho_fonte: 'normal' // pequena | normal | grande
};

// Instância viva (carregada do Firestore ao logar)
export const configPdf = { ...CONFIG_PDF_PADRAO };

// ---------- Carregar config do Firestore ----------
export async function carregarConfigPDF() {
    try {
        const ref = doc(db, "config", "pdf");
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const d = snap.data();
            Object.keys(CONFIG_PDF_PADRAO).forEach(k => {
                if (typeof d[k] !== 'undefined') configPdf[k] = d[k];
            });
        } else {
            await setDoc(ref, CONFIG_PDF_PADRAO);
        }
    } catch (e) {
        console.warn("Não foi possível carregar config de PDF:", e);
    }
}

// ---------- Salvar config no Firestore ----------
export async function salvarConfigPDF() {
    try {
        await setDoc(doc(db, "config", "pdf"), { ...configPdf });
        return true;
    } catch (e) {
        console.error("Erro ao salvar config de PDF:", e);
        return false;
    }
}