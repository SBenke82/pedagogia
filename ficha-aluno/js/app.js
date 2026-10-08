// =============================================================
// app.js
// Orquestrador: importa tudo, expõe no window, inicializa
// =============================================================

// ---------- Config + estado ----------
import { auth, db, estado, configPdf, carregarConfigPDF, salvarConfigPDF } from './config.js';

// ---------- Utilitários ----------
import {
    el,
    autoResizeTextarea
} from './utils.js';

window.autoResizeTextarea = autoResizeTextarea;

// ---------- Aparência ----------
import {
    carregarAparencia,
    carregarAparenciaDoFirestore,
    aplicarLogo,
    aplicarModoEscuro
} from './aparencia.js';

// ---------- Motor de PDF ----------
import './pdf.js';

// ---------- Auth ----------
import { iniciarAuth } from './auth.js';

// ---------- Módulos funcionais ----------
import {
    carregarTurmas,
    carregarTurmasCache,
    abrirTurma,
    carregarAlunosDaTurma
} from './turmas.js';

import {
    carregarTodosOsAlunos,
    abrirFichaAluno,
    abrirFichaAlunoPorBusca,
    ativarDeteccaoAlteracoes
} from './alunos.js';

import { carregarOcorrencias } from './ocorrencias.js';
import { carregarAnexos } from './anexos.js';
import { carregarConselhosComRegistro, fichasDoAluno } from './conselhos.js';
import { carregarUsuarios } from './usuarios.js';

import './backup.js';

// =============================================================
// EXPOR NO WINDOW
// =============================================================
window.carregarTurmas = carregarTurmas;
window.carregarTurmasCache = carregarTurmasCache;
window.abrirTurma = abrirTurma;
window.carregarAlunosDaTurma = carregarAlunosDaTurma;

window.carregarTodosOsAlunos = carregarTodosOsAlunos;
window.abrirFichaAluno = abrirFichaAluno;
window.abrirFichaAlunoPorBusca = abrirFichaAlunoPorBusca;

window.carregarOcorrencias = carregarOcorrencias;
window.carregarAnexos = carregarAnexos;
window.carregarConselhosComRegistro = carregarConselhosComRegistro;
window.fichasDoAluno = fichasDoAluno;

window.carregarUsuarios = carregarUsuarios;

window.aplicarLogo = aplicarLogo;
window.aplicarModoEscuro = aplicarModoEscuro;

// =============================================================
// NAVEGAÇÃO
// =============================================================
window.alternarConfiguracoes = function() {
    if (estado.fichaTemAlteracoes && !el('telaFichaAluno').classList.contains('hidden')) {
        if (!confirm("⚠️ Você tem alterações não salvas na ficha do aluno.\n\nDeseja realmente sair sem salvar?")) return;
    }
    const cfg = el('telaConfig');
    const telas = ['telaTurmas', 'telaTurmaDetalhe', 'telaFichaAluno'];
    if (cfg.classList.contains('hidden')) {
        const visivel = telas.find(i => !el(i).classList.contains('hidden'));
        if (visivel) estado.telaAntesConfig = visivel;
        telas.forEach(i => el(i).classList.add('hidden'));
        cfg.classList.remove('hidden');
        if (estado.usuarioCargo === 'diretor') carregarUsuarios();
    } else {
        cfg.classList.add('hidden');
        el(estado.telaAntesConfig).classList.remove('hidden');
        if (estado.telaAntesConfig === 'telaTurmas') carregarTurmas();
    }
};

window.mudarAbaConfig = function(aba) {
    document.querySelectorAll('.menu-config button').forEach(b => b.classList.remove('ativo'));
    document.querySelectorAll('#telaConfig > .form-config').forEach(f => f.classList.add('hidden'));

    const ids = {
        turma: ['btnConfigTurma', 'abaTurma'],
        usuario: ['btnConfigUsuario', 'abaUsuario'],
        senha: ['btnConfigSenha', 'abaSenha'],
        exportarPDF: ['btnConfigExportarPDF', 'abaExportarPDF'],
        aparencia: ['btnConfigAparencia', 'abaAparencia'],
        backup: ['btnConfigBackup', 'abaBackup']
    };
    const par = ids[aba];
    if (!par) return;

    if (estado.usuarioCargo !== 'diretor' && ['usuario', 'aparencia', 'backup'].includes(aba)) return;

    el(par[0]).classList.add('ativo');
    el(par[1]).classList.remove('hidden');

    if (aba === 'usuario') carregarUsuarios();
    if (aba === 'exportarPDF') popularFormConfigPDF();
};

// =============================================================
// CONFIGURAÇÕES DE PDF (aba "🖨️ Impressão / PDF")
// =============================================================

// Lista de todas as chaves booleanas
const CHAVES_BOOL = [
    // Relatório
    'relatorio_cabecalho_logo', 'relatorio_foto', 'relatorio_idade',
    'relatorio_encaminhamentos', 'relatorio_observacoes', 'relatorio_estudo_caso',
    'relatorio_anexos', 'relatorio_incluir_conselho', 'relatorio_incluir_ocorrencias',
    'relatorio_incluir_relatorios_estudante', 'relatorio_incluir_relatorios_inclusao',
    'relatorio_assinatura_pedagogo', 'relatorio_assinatura_professor',
    'relatorio_assinatura_apoio', 'relatorio_assinatura_responsavel',
    'relatorio_visto_direcao', 'relatorio_rodape_emissao', 'relatorio_numeracao_pagina',
    // Ocorrências
    'ocorrencias_cabecalho_logo', 'ocorrencias_foto', 'ocorrencias_encaminhamentos',
    'ocorrencias_observacoes', 'ocorrencias_estudo_caso', 'ocorrencias_anexos',
    'ocorrencias_assinatura_pedagogo', 'ocorrencias_assinatura_professor',
    'ocorrencias_assinatura_apoio', 'ocorrencias_assinatura_responsavel',
    'ocorrencias_rodape_emissao', 'ocorrencias_numeracao_pagina',
    // Compartilhado
    'mostrar_somente_encaminhamentos', 'estilo_monocromatico'
];

// Preenche os checkboxes com os valores atuais de configPdf
function popularFormConfigPDF() {
    CHAVES_BOOL.forEach(k => {
        const cb = el(k);
        if (cb) cb.checked = !!configPdf[k];
    });
    // Select de filtro de ocorrências
    const selFiltro = el('ocorrencias_filtro');
    if (selFiltro) selFiltro.value = configPdf.ocorrencias_filtro || 'todas';

    // Select de tamanho de fonte
    const selFonte = el('estilo_tamanho_fonte');
    if (selFonte) selFonte.value = configPdf.estilo_tamanho_fonte || 'normal';
}

// Aplica um preset (completo / essencial / só ocorrências / só conselho)
window.aplicarPresetImpressao = function(preset) {
    // Zera tudo
    CHAVES_BOOL.forEach(k => {
        const cb = el(k);
        if (cb) cb.checked = false;
    });

    if (preset === 'completo') {
        // Tudo ligado
        CHAVES_BOOL.forEach(k => {
            const cb = el(k);
            if (cb) cb.checked = true;
        });
    } else if (preset === 'essencial') {
        const ligados = [
            'relatorio_cabecalho_logo', 'relatorio_idade', 'relatorio_encaminhamentos',
            'relatorio_observacoes', 'relatorio_estudo_caso',
            'relatorio_assinatura_responsavel', 'relatorio_rodape_emissao'
        ];
        ligados.forEach(k => {
            const cb = el(k);
            if (cb) cb.checked = true;
        });
    } else if (preset === 'ocorrencias') {
        const ligados = [
            'ocorrencias_cabecalho_logo', 'ocorrencias_assinatura_responsavel'
        ];
        ligados.forEach(k => {
            const cb = el(k);
            if (cb) cb.checked = true;
        });
    } else if (preset === 'conselho') {
        const ligados = [
            'relatorio_cabecalho_logo', 'relatorio_incluir_conselho'
        ];
        ligados.forEach(k => {
            const cb = el(k);
            if (cb) cb.checked = true;
        });
    }
};

// Salva todas as opções no Firestore
window.salvarConfiguracoesPDF = async function() {
    // Lê todos os booleanos
    CHAVES_BOOL.forEach(k => {
        const cb = el(k);
        if (cb) configPdf[k] = cb.checked;
    });

    // Lê os selects
    const selFiltro = el('ocorrencias_filtro');
    if (selFiltro) configPdf.ocorrencias_filtro = selFiltro.value;

    const selFonte = el('estilo_tamanho_fonte');
    if (selFonte) configPdf.estilo_tamanho_fonte = selFonte.value;

    // Salva no Firestore
    const ok = await salvarConfigPDF();
    if (ok) {
        alert("✅ Configurações de PDF salvas!");
    } else {
        alert("❌ Erro ao salvar configurações. Tente novamente.");
    }
};

// =============================================================
// INICIALIZAÇÃO
// =============================================================
carregarAparencia();
ativarDeteccaoAlteracoes();
carregarConfigPDF().catch(e => console.warn("Config PDF offline:", e));
iniciarAuth();

console.log('✅ App Ficha Aluno inicializado.');