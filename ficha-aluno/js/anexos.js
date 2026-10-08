// =============================================================
// anexos.js
// Upload, listagem e impressão de anexos (imagens)
// =============================================================

import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db, estado } from './config.js';
import { el, esc, enviarImgBB } from './utils.js';
import {
    criarDocPDF, carregarImagemBase64, PDF_CONFIG, larguraUtil
} from './pdf.js';

// =============================================================
// MODAL ADICIONAR ANEXO
// =============================================================
window.abrirModalAdicionarAnexo = function() {
    el('anexoNome').value = "";
    el('anexoArquivo').value = "";
    el('anexoPreview').innerHTML = "";
    el('modalAdicionarAnexo').classList.remove('hidden');
};

window.fecharModalAdicionarAnexo = function() {
    el('modalAdicionarAnexo').classList.add('hidden');
};

// Preview automático ao escolher arquivo
const inputAnexo = el('anexoArquivo');
if (inputAnexo) {
    inputAnexo.addEventListener('change', function(event) {
        const file = event.target.files[0];
        const prev = el('anexoPreview');
        prev.innerHTML = "";
        if (!file) return;

        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            const img = document.createElement('img');
            img.src = url;
            img.style.maxWidth = '200px';
            img.style.maxHeight = '150px';
            img.style.borderRadius = '8px';
            img.style.border = '2px solid var(--cor-borda)';
            prev.appendChild(img);
        } else {
            prev.innerHTML = '<p style="color:var(--cor-texto-suave);font-size:13px;">📄 ' + esc(file.name) + '</p>';
        }
    });
}

// =============================================================
// SALVAR ANEXO
// =============================================================
window.salvarAnexo = async function() {
    const nome = el('anexoNome').value.trim();
    const file = el('anexoArquivo').files[0];

    if (!nome) { alert("Digite um nome para o anexo."); return; }
    if (!file) { alert("Escolha um arquivo ou imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Arquivo muito grande. Máximo 5 MB."); return; }

    const btnSalvar = document.querySelector('#modalAdicionarAnexo .btn-salvar-modal');
    const btnCancelar = document.querySelector('#modalAdicionarAnexo .btn-cancelar-modal');
    const inputNome = el('anexoNome');
    const inputArquivo = el('anexoArquivo');
    const textoOriginal = btnSalvar.textContent;

    // Bloqueia campos enquanto envia
    btnSalvar.disabled = true;
    btnCancelar.disabled = true;
    inputNome.disabled = true;
    inputArquivo.disabled = true;
    btnSalvar.textContent = '⏳ Enviando...';

    try {
        const url = await enviarImgBB(file);

        const anexo = {
            id: 'anx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            nome,
            url,
            criadoEm: new Date().toISOString(),
            criadoPor: estado.usuarioLogado.email
        };

        await updateDoc(doc(db, "alunos", estado.alunoAtualId), {
            anexos: arrayUnion(anexo)
        });

        fecharModalAdicionarAnexo();
        await carregarAnexos();
        alert("✅ Anexo salvo!");
    } catch (e) {
        alert("Erro ao salvar anexo: " + e.message);
    } finally {
        btnSalvar.disabled = false;
        btnCancelar.disabled = false;
        inputNome.disabled = false;
        inputArquivo.disabled = false;
        btnSalvar.textContent = textoOriginal;
    }
};

// =============================================================
// LISTAR ANEXOS
// =============================================================
export async function carregarAnexos() {
    const alunoSnap = await getDoc(doc(db, "alunos", estado.alunoAtualId));
    const anexos = (alunoSnap.data().anexos || []).slice();
    anexos.sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
    estado.anexosAtuais = anexos;

    const lista = el('listaAnexos');
    lista.innerHTML = "";

    if (anexos.length === 0) {
        lista.innerHTML = "<p style='color:var(--cor-texto-suave);font-size:14px;grid-column:1/-1;'>Nenhum anexo cadastrado.</p>";
        return;
    }

    anexos.forEach(a => {
        const card = document.createElement('div');
        card.className = 'anexo-card';
        card.innerHTML = `
            <img src="${esc(a.url)}" alt="${esc(a.nome)}" onclick="abrirFotoFull('${esc(a.url)}')">
            <div class="anexo-nome">${esc(a.nome)}</div>
            <div class="anexo-acoes">
                <button onclick="abrirFotoFull('${esc(a.url)}')" title="Ver">👁️</button>
                <button onclick="imprimirAnexo('${esc(a.url)}','${esc(a.nome)}')" title="Imprimir">🖨️</button>
                <button onclick="excluirAnexo('${esc(a.id)}')" title="Excluir">🗑️</button>
            </div>
        `;
        lista.appendChild(card);
    });
}

// =============================================================
// EXCLUIR ANEXO
// =============================================================
window.excluirAnexo = async function(anexoId) {
    if (!confirm("Excluir este anexo?")) return;

    try {
        const alunoSnap = await getDoc(doc(db, "alunos", estado.alunoAtualId));
        let anexos = alunoSnap.data().anexos || [];
        anexos = anexos.filter(a => a.id !== anexoId);

        await updateDoc(doc(db, "alunos", estado.alunoAtualId), { anexos });
        await carregarAnexos();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// VISUALIZAR FOTO EM TELA CHEIA
// =============================================================
window.abrirFotoFull = function(url) {
    el('fotoFullImg').src = url;
    el('modalFotoFull').classList.remove('hidden');
    estado.urlFotoFull = url;
};

window.fecharFotoFull = function() {
    el('modalFotoFull').classList.add('hidden');
    el('fotoFullImg').src = "";
    estado.urlFotoFull = null;
};

// =============================================================
// IMPRESSÃO DE ANEXO (PDF)
// =============================================================
window.imprimirAnexoAtual = function() {
    if (!estado.urlFotoFull) return;
    window.imprimirAnexo(estado.urlFotoFull, 'Anexo');
};

window.imprimirAnexo = async function(url, nome) {
    const doc = criarDocPDF(nome);
    try {
        const dataUrl = await carregarImagemBase64(url);
        const img = new Image();
        img.src = dataUrl;
        await new Promise(r => { img.onload = r; });

        const maxW = larguraUtil();
        const maxH = PDF_CONFIG.alturaPagina - PDF_CONFIG.margem * 2 - 20;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const escala = Math.min(maxW / w, maxH / h, 1);
        w *= escala;
        h *= escala;

        doc.setFontSize(12);
        doc.setFont(PDF_CONFIG.fonteBase, 'bold');
        doc.text(nome, PDF_CONFIG.larguraPagina / 2, PDF_CONFIG.margem + 5, { align: 'center' });
        doc.addImage(dataUrl, 'JPEG',
            (PDF_CONFIG.larguraPagina - w) / 2,
            PDF_CONFIG.margem + 12,
            w, h
        );
    } catch (e) {
        alert("Erro ao gerar PDF do anexo: " + e.message);
        return;
    }
    doc.save(`${nome.replace(/\s+/g, '_')}.pdf`);
};

// =============================================================
// ESC fecha o modal de foto em tela cheia
// =============================================================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = el('modalFotoFull');
        if (modal && !modal.classList.contains('hidden')) fecharFotoFull();
    }
});