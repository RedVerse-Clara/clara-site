import requests
import datetime
import re
import unicodedata

# CONFIGURATION
BASE_URL = "https://lechoixdeclara.fr"
PROJECT_ID = "le-choix-de-clara"
COLLECTION_PATH = "artifacts/le-choix-de-clara/public/data/articles"

def slugify(text):
    """Génère un slug SEO-friendly (identique à src/utils/slugify.js)"""
    text = str(text).lower()
    text = unicodedata.normalize('NFD', text)
    text = re.sub(r'[\u0300-\u036f]', '', text)
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = text.strip()
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text

def fetch_articles():
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{COLLECTION_PATH}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        return data.get('documents', [])
    return []

def get_article_slug(art):
    """Récupère le slug d'un article (champ slug ou slugify du titre)"""
    fields = art.get('fields', {})
    slug = fields.get('slug', {}).get('stringValue', '')
    if slug:
        return slug
    title = fields.get('title', {}).get('stringValue', '')
    return slugify(title)

def generate_sitemap(articles):
    today = datetime.date.today().isoformat()

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    # Page d'accueil
    xml += f'  <url>\n    <loc>{BASE_URL}/</loc>\n    <lastmod>{today}</lastmod>\n    <priority>1.0</priority>\n  </url>\n'

    # Page À Propos
    xml += f'  <url>\n    <loc>{BASE_URL}/about</loc>\n    <lastmod>{today}</lastmod>\n    <priority>0.8</priority>\n  </url>\n'

    # Pages catégories
    xml += f'  <url>\n    <loc>{BASE_URL}/le-dressing</loc>\n    <lastmod>{today}</lastmod>\n    <priority>0.7</priority>\n  </url>\n'
    xml += f'  <url>\n    <loc>{BASE_URL}/le-coin-geek</loc>\n    <lastmod>{today}</lastmod>\n    <priority>0.7</priority>\n  </url>\n'

    # Articles dynamiques avec URLs propres
    for art in articles:
        slug = get_article_slug(art)
        if slug:
            xml += f'  <url>\n    <loc>{BASE_URL}/article/{slug}</loc>\n    <lastmod>{today}</lastmod>\n    <priority>0.6</priority>\n  </url>\n'

    xml += '</urlset>'
    return xml

if __name__ == "__main__":
    print("Récupération des articles depuis Firebase...")
    articles = fetch_articles()
    print(f"{len(articles)} articles trouvés.")

    sitemap_content = generate_sitemap(articles)

    with open("public/sitemap.xml", "w", encoding="utf-8") as f:
        f.write(sitemap_content)

    print("sitemap.xml généré avec succès.")
