// =============================================================
// backup.js
// Baixar e restaurar backup dos dados do sistema (somente Diretor)
// =============================================================

import {
    collection, getDocs, doc, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db, estado } from './config.js';
import { el, dataLocalISO } from './utils.js';

const ehDiretor = () => estado.usuarioCargo === 'diretor';

// =============================================================
// BAIXAR BACKUP
// =============================================================
window.fazerBackup = async function() {
    if (!ehDiretor()) { alert("Apenas o Diretor pode fazer backup."); return; }

    try {
        const backup = {
            turmas: [],
            alunos: [],
            fichas: [],
            usuarios_sistema: []
        };

        for (const nome of Object.keys(backup)) {
            const snap = await getDocs(collection(db, nome));
            snap.forEach(d => backup[nome].push({ id: d.id, ...d.data() }));
        }

        const blob = new Blob(
            [JSON.stringify(backup, null, 2)],
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_escola_${dataLocalISO()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        alert("✅ Backup baixado!");
    } catch (e) {
        alert("Erro: " + e.message);
    }
};

// =============================================================
// RESTAURAR BACKUP
// =============================================================
window.restaurarBackup = async function() {
    if (!ehDiretor()) { alert("Apenas o Diretor pode restaurar backup."); return; }

    const input = el('inputRestaurar');
    if (input.files.length === 0) { alert("Selecione um arquivo."); return; }

    if (!confirm("⚠️ A restauração gravará turmas, alunos e fichas do arquivo. Continuar?")) return;

    try {
        const backup = JSON.parse(await input.files[0].text());

        for (const colecao of ['turmas', 'alunos', 'fichas']) {
            if (!Array.isArray(backup[colecao])) continue;
            for (const item of backup[colecao]) {
                const { id, ...d } = item;
                if (!id) continue;
                await setDoc(doc(db, colecao, id), d, { merge: true });
            }
        }

        alert("✅ Backup restaurado!");
        input.value = "";

        // Recarrega dados na tela
        if (typeof window.carregarTurmas === 'function') window.carregarTurmas();
        if (typeof window.carregarTodosOsAlunos === 'function') await window.carregarTodosOsAlunos();
    } catch (e) {
        alert("Erro: " + e.message);
    }
};