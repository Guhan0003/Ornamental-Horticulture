/**
 * Contact details shown in the popup behind the round button at the bottom
 * left of every public page. Leave any value as '' and it is simply not shown.
 *
 * The phone, WhatsApp, email, Instagram and WhatsApp message below can be changed
 * from the dashboard's Settings page, without touching the code. What is saved there
 * wins; what is written here is only used until something is saved, and whenever the
 * server cannot be reached. Everything else in this file is changed here.
 */
export const contact = {
  name: 'StomatalWorld',
  tagline: 'Ornamental Horticulture',

  heading: 'Let’s Grow Together',
  description:
    'Have a question, need plant care support, or looking to place an order?',
  // Shown in bold under the description.
  highlight: 'Get in touch with us anytime — we’re here to help.',

  // Optional round photo or logo, e.g. '/avatar.jpg' placed in frontend/public/.
  // Leave '' to show the leaf mark.
  avatar: '',

  // Written the way people should see it. Links are built from the digits.
  phone: '+91 86087 05789',

  // Include the country code. Can be the same number as phone.
  whatsapp: '+91 86087 05789',
  // Pre-filled message when someone opens WhatsApp.
  whatsappMessage: 'Hi! I saw your plants at StomatalWorld and have a question.',

  email: 'stomatalworldd@gmail.com',

  // The handle only, without @ or the full link.
  instagram: 'stomatalworld',
}
