import prisma from './prisma'

/**
 * Busca um contato no banco de dados considerando a variação do 9º dígito para números brasileiros.
 * @param phone Número de telefone sanitizado (somente números)
 */
export async function findContactByPhone(phone: string) {
  // 1. Busca exata
  let contact = await prisma.contact.findUnique({
    where: { phone }
  })
  
  if (contact) return contact

  // 2. Se for número brasileiro, verifica a variação do 9º dígito
  if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) {
    const alternativePhone = phone.length === 13
      ? phone.slice(0, 4) + phone.slice(5) // Remove o 9º dígito (ex: 5544999970195 -> 554499970195)
      : phone.slice(0, 4) + '9' + phone.slice(4) // Adiciona o 9º dígito (ex: 554499970195 -> 5544999970195)
      
    contact = await prisma.contact.findUnique({
      where: { phone: alternativePhone }
    })
  }
  
  return contact
}
