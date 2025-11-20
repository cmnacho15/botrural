import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Usa SERVICE_ROLE para bypass de RLS
);

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!;

/**
 * Descarga imagen desde WhatsApp Media API
 */
export async function downloadWhatsAppImage(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    // 1. Obtener URL de descarga del media
    const urlResponse = await fetch(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );

    if (!urlResponse.ok) {
      throw new Error(`Error obteniendo URL: ${urlResponse.status}`);
    }

    const urlData = await urlResponse.json();
    const mediaUrl = urlData.url;

    if (!mediaUrl) {
      throw new Error('No se obtuvo URL del media');
    }

    // 2. Descargar la imagen
    const imageResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
    });

    if (!imageResponse.ok) {
      throw new Error(`Error descargando imagen: ${imageResponse.status}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    return { buffer, mimeType };
  } catch (error) {
    console.error('Error descargando imagen de WhatsApp:', error);
    return null;
  }
}

/**
 * Sube imagen a Supabase Storage
 */
export async function uploadInvoiceToSupabase(
  imageBuffer: Buffer,
  mimeType: string,
  campoId: string
): Promise<{ url: string; fileName: string } | null> {
  try {
    const fileExtension = mimeType.split('/')[1] || 'jpg';
    const fileName = `${campoId}/${Date.now()}_${uuidv4()}.${fileExtension}`;

    const { data, error } = await supabase.storage
      .from('facturas')
      .upload(fileName, imageBuffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600', // Cache 1 hora
      });

    if (error) {
      console.error('Error subiendo a Supabase:', error);
      return null;
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from('facturas')
      .getPublicUrl(data.path);

    return {
      url: publicUrlData.publicUrl,
      fileName: data.path,
    };
  } catch (error) {
    console.error('Error en uploadInvoiceToSupabase:', error);
    return null;
  }
}

/**
 * Convierte Buffer a Data URL para Vision API
 */
export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}