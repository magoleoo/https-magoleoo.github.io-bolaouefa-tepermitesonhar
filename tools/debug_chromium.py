from playwright.sync_api import sync_playwright
import os

html_path = "file://" + os.path.abspath("index.html")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Listen to ALL console events and uncaught page errors
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        
        print(f"Loading {html_path}...")
        page.goto(html_path)
        
        # Give it a second to execute top level scripts
        page.wait_for_timeout(2000)
        
        # Click the button
        print("Clicking Entrar sem identificar...")
        page.locator("#skip-login-button").click()
        
        # Wait for renderApp to finish
        page.wait_for_timeout(1000)
        
        browser.close()

if __name__ == "__main__":
    run()
