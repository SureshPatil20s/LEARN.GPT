"""
Web Search & Live Website Walkthrough Service:
- Extracts URLs from user prompts and walks through live web pages
- Parses clean text, headings, and structure using BeautifulSoup
- Provides web search retrieval using DuckDuckGo HTML / Instant Answers API
"""
import re
import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Tuple
from urllib.parse import urljoin

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

# URL extraction regex
URL_REGEX = re.compile(
    r'(https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*))',
    re.IGNORECASE
)


def extract_urls(text: str) -> List[str]:
    """Extract all URLs from text."""
    if not text:
        return []
    matches = URL_REGEX.findall(text)
    # Deduplicate while preserving order
    seen = set()
    urls = []
    for u in matches:
        clean = u.rstrip(".,;!?'\")")
        if clean not in seen:
            seen.add(clean)
            urls.append(clean)
    return urls


async def fetch_website_content(url: str, timeout: float = 8.0) -> Dict[str, str]:
    """
    Fetches a live website, parses the DOM, extracts rich metadata,
    inspects SPA bundles if client-rendered, and returns a comprehensive structured walkthrough.
    """
    try:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=timeout) as client:
            resp = await client.get(url)
            if resp.status_code >= 400:
                return {
                    "url": url,
                    "title": f"HTTP {resp.status_code}",
                    "content": f"Unable to access {url} (HTTP {resp.status_code}). The site may require authentication or block automated requests.",
                    "success": False
                }

            html = resp.text
            soup = BeautifulSoup(html, "html.parser")

            # 1. Extract Rich Metadata BEFORE decomposing tags
            title = soup.title.string.strip() if soup.title and soup.title.string else url

            meta_desc = ""
            desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
            if desc_tag and desc_tag.get("content"):
                meta_desc = desc_tag.get("content").strip()

            og_title = ""
            og_tag = soup.find("meta", attrs={"property": "og:title"})
            if og_tag and og_tag.get("content"):
                og_title = og_tag.get("content").strip()

            site_name = ""
            sn_tag = soup.find("meta", attrs={"property": "og:site_name"})
            if sn_tag and sn_tag.get("content"):
                site_name = sn_tag.get("content").strip()

            keywords = ""
            kw_tag = soup.find("meta", attrs={"name": "keywords"})
            if kw_tag and kw_tag.get("content"):
                keywords = kw_tag.get("content").strip()

            # Check for JSON-LD schema
            json_ld_snippets = []
            for jld in soup.find_all("script", attrs={"type": "application/ld+json"}):
                if jld.string:
                    json_ld_snippets.append(jld.string.strip())

            # Check for linked script bundles in case of Single Page Applications (React/Vite/Vue)
            script_srcs = [s.get("src") for s in soup.find_all("script") if s.get("src")]

            # 2. Extract DOM content
            # Remove noise
            for tag in soup(["script", "style", "nav", "footer", "noscript", "svg", "header", "aside"]):
                tag.decompose()

            # Extract main readable content
            main = soup.find("main") or soup.find("article") or soup.find("div", {"id": "content"}) or soup.body
            if main:
                text = main.get_text(separator="\n", strip=True)
            else:
                text = soup.get_text(separator="\n", strip=True)

            lines = [line.strip() for line in text.splitlines() if line.strip()]
            cleaned_text = "\n".join(lines[:350])

            # 3. If content is sparse (SPA like <div id="root"></div>), inspect the main JS bundle
            spa_extras = []
            if len(cleaned_text) < 250 and script_srcs:
                app_scripts = [s for s in script_srcs if any(k in s.lower() for k in ["index", "main", "app", "bundle"])]
                if not app_scripts and script_srcs:
                    app_scripts = [script_srcs[0]]

                if app_scripts:
                    bundle_url = urljoin(url, app_scripts[0])
                    try:
                        js_resp = await client.get(bundle_url, timeout=5.0)
                        if js_resp.status_code == 200:
                            js_text = js_resp.text
                            # Extract external platform links (Unstop, Devfolio, Google Forms, YouTube, etc.)
                            event_links = list(dict.fromkeys(re.findall(r'https?://[a-zA-Z0-9\-\.]+(?:unstop|devfolio|forms\.gle|github|linkedin|instagram)[^\s"\'<>]+', js_text)))
                            if event_links:
                                spa_extras.append("Event / Registration Links:\n" + "\n".join(f"- {l}" for l in event_links[:10]))

                            # Extract strings mentioning institution, events, or organizers
                            text_candidates = re.findall(r'"([^"\\]{12,120})"', js_text)
                            context_terms = ["university", "college", "institute", "fest", "hackathon", "organizer", "host", "department", "campus", "venue", "registration", "davanagere", "karnataka", "ignitron"]
                            relevant_strings = []
                            for cand in text_candidates:
                                cand_lower = cand.lower()
                                if any(term in cand_lower for term in context_terms) and not any(ign in cand_lower for ign in ["react", "node_modules", "webpack", "error", "warning", "invariant", "fiber", "renderer", "package", "hostinstance", "bundle"]):
                                    relevant_strings.append(cand)

                            unique_relevant = list(dict.fromkeys(relevant_strings))
                            if unique_relevant:
                                spa_extras.append("Key Application Details & Entities:\n" + "\n".join(f"• {s}" for s in unique_relevant[:25]))
                    except Exception:
                        pass

            # Build comprehensive output
            header_parts = []
            header_parts.append(f"Title: {title}")
            if og_title and og_title != title:
                header_parts.append(f"OG Title: {og_title}")
            if site_name:
                header_parts.append(f"Site Name: {site_name}")
            if meta_desc:
                header_parts.append(f"Description: {meta_desc}")
            if keywords:
                header_parts.append(f"Keywords: {keywords}")

            full_content_sections = [
                "=== [Page Metadata] ===",
                "\n".join(header_parts)
            ]

            if json_ld_snippets:
                full_content_sections.append("=== [Structured Data (JSON-LD)] ===")
                full_content_sections.append("\n".join(json_ld_snippets[:2]))

            if cleaned_text and len(cleaned_text) >= 100:
                full_content_sections.append("=== [Page Content] ===")
                full_content_sections.append(cleaned_text)

            if spa_extras:
                full_content_sections.append("=== [Client-Side App Extracted Data] ===")
                full_content_sections.append("\n\n".join(spa_extras))

            final_content = "\n\n".join(full_content_sections)
            if len(final_content) > 8000:
                final_content = final_content[:8000] + "\n...[Content truncated for length]..."

            return {
                "url": url,
                "title": title,
                "content": final_content,
                "success": True
            }
    except Exception as e:
        return {
            "url": url,
            "title": "Fetch Error",
            "content": f"Could not fetch website {url}: {str(e)}",
            "success": False
        }


async def search_duckduckgo(query: str, max_results: int = 4) -> List[Dict[str, str]]:
    """
    Perform a live web search via DuckDuckGo HTML endpoint and return top snippets.
    """
    results = []
    try:
        url = "https://html.duckduckgo.com/html/"
        data = {"q": query}
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=7.0, follow_redirects=True) as client:
            resp = await client.post(url, data=data)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for r in soup.select(".result")[:max_results]:
                    title_elem = r.select_one(".result__title a")
                    snippet_elem = r.select_one(".result__snippet")
                    url_elem = r.select_one(".result__url")

                    if title_elem and snippet_elem:
                        title = title_elem.get_text(strip=True)
                        snippet = snippet_elem.get_text(strip=True)
                        link = title_elem.get("href", "")
                        # DuckDuckGo redirect link decoding
                        if "uddg=" in link:
                            import urllib.parse
                            parsed = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
                            link = parsed.get("uddg", [link])[0]

                        results.append({
                            "title": title,
                            "snippet": snippet,
                            "url": link
                        })
    except Exception as e:
        print(f"Web search error: {e}")

    return results


async def build_web_context(prompt: str, use_web_search: bool = False) -> Tuple[str, List[Dict[str, str]]]:
    """
    Analyzes prompt for URLs and/or search intent.
    Fetches real-time web page content or search results and returns:
    (formatted_context_block, web_sources_list)
    """
    urls = extract_urls(prompt)
    sources = []
    context_parts = []

    # Case 1: Specific URL walkthrough requested
    if urls:
        for url in urls[:2]:  # Walk through up to 2 URLs
            site = await fetch_website_content(url)
            sources.append({
                "title": site["title"],
                "url": site["url"],
                "snippet": site["content"][:240].replace("\n", " ") + "..."
            })
            context_parts.append(
                f"[LIVE WEBSITE WALKTHROUGH & CONTENT FROM {site['url']}]\n"
                f"Page Title: {site['title']}\n"
                f"Extracted Page Content:\n{site['content']}\n"
                f"(INSTRUCTION: Walk through this website content thoroughly. Explain what the site is, its features, and answer the user's specific questions based directly on this live page content.)"
            )

    # Case 2: Explicit search requested or web search toggle is ON (and no specific URL was given)
    elif use_web_search or any(k in prompt.lower() for k in [
        "search the web", "search online", "look up on google", "google it", "current news", "latest news", "browse the web"
    ]):
        clean_query = re.sub(
            r'^(?:can you\s+)?(?:please\s+)?(?:search the web for|search online for|search for|look up|google|browse for)\s+',
            '', prompt, flags=re.IGNORECASE
        ).strip()
        search_results = await search_duckduckgo(clean_query[:100] or prompt[:100], max_results=4)
        if search_results:
            search_text = []
            for idx, res in enumerate(search_results, 1):
                sources.append(res)
                search_text.append(f"[{idx}] {res['title']} ({res['url']}):\n{res['snippet']}")

            context_parts.append(
                f"[LIVE REAL-TIME WEB SEARCH RESULTS FOR: '{clean_query}']:\n" +
                "\n\n".join(search_text) +
                "\n(INSTRUCTION: Use these live real-time search results to provide an up-to-date, accurate answer with citations.)"
            )

    combined_context = "\n\n".join(context_parts)
    return combined_context, sources
