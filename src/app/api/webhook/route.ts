// Redirecionamento e espelhamento premium de segurança da Cipriano Escola de Negócios.
// Garante que requisições ao Webhook com "W" maiúsculo (api/Webhook) funcionem 
// de forma idêntica e sem quebras no ambiente Linux case-sensitive da Vercel.

export { GET, POST } from '../webhook/route'
