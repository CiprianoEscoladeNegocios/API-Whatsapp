export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    /*
     * Protege todas as rotas da plataforma exceto:
     * - api/auth (NextAuth API routes)
     * - api/webhook (Webhooks públicos do Twilio/WhatsApp)
     * - login (Página de login da Cipriano)
     * - invite (Página pública de convite para os alunos)
     * - group-chat (Sala de chat pública para os alunos)
     * - api/groups (Endpoints públicos de grupos virtuais para o fluxo do aluno)
     * - _next/static, _next/image, favicon.ico (recursos estáticos)
     */
    "/((?!api/auth|api/webhook|api/Webhook|api/test-db-connection|api/test-auth-env|api/chat/media|api/chat/download|login|invite|group-chat|api/groups|_next/static|_next/image|favicon.ico).*)",
  ],
}
