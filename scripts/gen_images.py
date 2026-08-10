"""One-off AYANA hero image generator (Gemini Nano Banana via Emergent key).

Generates warm, GOLD-forward, photoreal images of elderly Indian parents and
saves them into the frontend public/ folder for the landing page.
Run:  python /app/scripts/gen_images.py
"""
import asyncio
import os
import base64
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")
API_KEY = os.getenv("EMERGENT_LLM_KEY")
MODEL = "gemini-3.1-flash-image-preview"
OUT = "/app/frontend/public"

STYLE = (
    "Photorealistic editorial portrait, cinematic soft natural window light, shallow depth of field, "
    "warm GOLDEN hour tones, rich gold / honey / amber colour grade with cream and soft terracotta accents, "
    "luxury magazine quality, gentle film grain, tender and dignified mood, authentic Indian setting. "
    "No text, no watermark, no logo."
)

JOBS = [
    ("ayana_amma.png",
     "A joyful elderly Indian mother (Amma) in her late 60s wearing an elegant golden-yellow silk saree, "
     "silver hair neatly tied, a small red bindi, warm genuine smile with kind eyes, looking slightly off camera, "
     "soft bokeh of a sunlit traditional Indian home behind her. " + STYLE),
    ("ayana_nanna.png",
     "A warm elderly Indian couple in their late 60s-70s, the father (Nanna) in a cream kurta and the mother in a "
     "golden saree, sitting close together on a sunlit verandah, laughing gently, deeply affectionate candid moment. " + STYLE),
    ("ayana_hands.png",
     "Intimate close-up of the wrinkled hands of an elderly Indian parent gently holding a modern smartphone showing a "
     "green WhatsApp-style chat, golden warm light catching the screen glow, a golden bangle on the wrist, blurred cosy background. " + STYLE),
    ("ayana_child.png",
     "A warm, happy adult Indian woman in her late 30s (a daughter living abroad) smiling with relief and love while "
     "looking at her smartphone, soft modern apartment with golden evening light through a window behind her. " + STYLE),
]


async def main():
    print("Starting generation with", MODEL)
    for fname, prompt in JOBS:
        try:
            chat = LlmChat(api_key=API_KEY, session_id=f"ayana-img-{fname}",
                           system_message="You are an expert photographer generating premium editorial images.")
            chat.with_model("gemini", MODEL).with_params(modalities=["image", "text"])
            _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
            if images:
                data = base64.b64decode(images[0]["data"])
                path = os.path.join(OUT, fname)
                with open(path, "wb") as f:
                    f.write(data)
                print(f"OK  {fname}  ({len(data)} bytes)  mime={images[0]['mime_type']}")
            else:
                print(f"FAIL {fname}: no image returned")
        except Exception as e:
            print(f"ERROR {fname}: {e}")


if __name__ == "__main__":
    asyncio.run(main())
