import requests
import datetime

# CONFIGURATION
BASE_URL = "https://lechoixdeclara.fr"
PROJECT_ID = "le-choix-de-clara"
COLLECTION_PATH = "artifacts/le-choix-de-clara/public/data/articles"

def fetch_articles():
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{COLLECTION_PATH}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        return data.get('documents', [])
    return []

def generate_sitemap(articles):
    today = datetime.date.today().isoformat()
    
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    
    # Page d'accueil
    xml += f'  <url>\n    <loc>{BASE_URL}/</loc>\n    <lastmod>{today}</lastmod>\n    <priority>1.0</priority>\n  </url>\n'
    
    # Page À Propos
    xml += f'  <url>\n    <loc>{BASE_URL}/?p=about</loc>\n    <lastmod>{today}</lastmod>\n    <priority>0.8</priority>\n  </url>\n'
    
    # Articles dynamiques
    for art in articles:
        # Extraire l'ID du nom complet du document
        doc_name = art.get('name', '')
        art_id = doc_name.split('/')[-1]
        xml += f'  <url>\n    <loc>{BASE_URL}/?a={art_id}</loc>\n    <lastmod>{today}</lastmod>\n    <priority>0.6</priority>\n  </url>\n'
        
    xml += '</urlset>'
    return xml

if __name__ == "__main__":
    print("Récupération des articles depuis Firebase...")
    articles = fetch_articles()
    print(f"{len(articles)} articles trouvés.")
    
    sitemap_content = generate_sitemap(articles)
    
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(sitemap_content)
    
    print("sitemap.xml généré avec succès.")
