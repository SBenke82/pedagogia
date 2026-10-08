// =============================================================
// utils.js
// Funções auxiliares usadas por vários módulos
// =============================================================

import { IMGBB_API_KEY } from './config.js';

// ---------- Escapar HTML (segurança) ----------
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

// ---------- Remover acentos e deixar minúsculo (busca) ----------
export const semAcento = s => String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// ---------- Atalho para getElementById ----------
export const el = id => document.getElementById(id);

// ---------- Auto-resize de textarea ----------
export function autoResizeTextarea(t) {
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
}

// ---------- Data local no formato AAAA-MM-DD ----------
export function dataLocalISO(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- Data + hora formatada pt-BR ----------
export function dataHoraFormatada(iso) {
    if (!iso) return '-';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('pt-BR') + ' às ' +
            d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
}

// ---------- Calcular idade a partir da data de nascimento ----------
export function calcularIdade(dataNasc) {
    if (!dataNasc) return 0;
    const hoje = new Date();
    const nasc = new Date(dataNasc + 'T00:00:00');
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
}

// ---------- Ler arquivo como base64 (sem o prefixo data:...) ----------
export function lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result.split(',')[1]);
        r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        r.readAsDataURL(file);
    });
}

// ---------- Enviar imagem para o imgBB ----------
export async function enviarImgBB(file) {
    const fd = new FormData();
    fd.append('key', IMGBB_API_KEY);
    fd.append('image', await lerArquivoBase64(file));
    const resp = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd });
    const data = await resp.json();
    if (!data.success) throw new Error("O serviço de imagens recusou o envio.");
    return data.data.url;
}

// ---------- Traduzir erros do Firebase Auth para pt-BR ----------
export function erroAuth(e) {
    const m = {
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/wrong-password': 'E-mail ou senha incorretos.',
        'auth/user-not-found': 'E-mail ou senha incorretos.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
        'auth/network-request-failed': 'Falha de conexão. Verifique a internet.',
        'auth/user-disabled': 'Usuário desativado.',
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/weak-password': 'Senha fraca. Use ao menos 6 caracteres.',
        'auth/requires-recent-login': 'Por segurança, saia e entre novamente antes de trocar a senha.'
    };
    return m[e.code] || e.message;
}
// ---------- Data BR (AAAA-MM-DD → DD/MM/AAAA) ----------
export function dataBR(iso) {
    if (!iso) return '-';
    if (String(iso).includes('/')) return iso;
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}/${a}`;
}