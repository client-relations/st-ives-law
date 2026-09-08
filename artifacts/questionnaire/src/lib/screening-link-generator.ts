import { supabase } from './supabase';

export async function generateScreeningLink(lawyerId: string): Promise<string | null> {
  try {
    if (!supabase) return null;

    // Generate UUID token
    const token = crypto.randomUUID();

    // Create screening submission entry with token
    const { data, error } = await supabase
      .from('screening_submissions')
      .insert({
        lawyer_id: lawyerId,
        unique_screening_token: token,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id');

    if (error) {
      console.error('Error creating screening submission:', error);
      return null;
    }

    // Generate shareable link
    const baseUrl = window.location.origin;
    const screeningLink = `${baseUrl}/?screeningLink=${token}`;

    return screeningLink;
  } catch (err) {
    console.error('Error generating screening link:', err);
    return null;
  }
}

export function copyToClipboard(text: string): boolean {
  try {
    navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}
