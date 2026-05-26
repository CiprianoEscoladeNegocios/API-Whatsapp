export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    /*
     * Protege todas as rotas da plataforma exceto:
     * - api/auth (NextAuth API routes)
     * - api/webhook (Webhooks públicos do Twilio/WhatsApp)
     * - login (Página de login da Cipriano)
     * - _next/static, _next/image, favicon.ico (recursos estáticos)
     */
    "/((?!api/auth|api/webhook|api/Webhook|api/test-db-connection|api/test-auth-env|login|_next/static|_next/image|favicon.ico).*)",
  ],
}
