import httpx
import ssl
import socket
import re
import dns.resolver
from urllib.parse import urlparse
from schemas.security import ScanResult


class SecurityScanner:
    async def scan(self, url: str) -> ScanResult:
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return ScanResult(url=url, headers={}, security_headers={}, tls_info={},
                cookies=[], redirects=[], technologies=[], findings=[{
                    "type": "invalid_url", "severity": "LOW",
                    "detail": "Invalid URL format",
                    "what_happened": f"'{url}' is not a valid URL.",
                    "why_it_matters": "A valid URL is required for scanning.",
                    "potential_impact": "Scan cannot proceed.",
                    "evidence": f"Input: {url}",
                    "recommendation": "Enter a valid URL like example.com",
                }])

        try:
            answers = dns.resolver.resolve(hostname, 'A')
            if not answers:
                raise Exception("No DNS records")
        except Exception:
            return ScanResult(url=url, headers={}, security_headers={}, tls_info={},
                cookies=[], redirects=[], technologies=[], findings=[{
                    "type": "domain_not_found", "severity": "LOW",
                    "detail": f"Domain '{hostname}' does not exist or has no DNS records",
                    "what_happened": f"DNS lookup for '{hostname}' failed. The domain does not resolve to any IP address.",
                    "why_it_matters": "The domain doesn't exist or isn't configured. Scanning is impossible.",
                    "potential_impact": "N/A - target is unreachable.",
                    "evidence": f"DNS resolution failed for {hostname}",
                    "recommendation": "Check the URL for typos. The domain must be a real, registered website.",
                }])

        headers = {}
        security_headers = {}
        tls_info = {}
        cookies = []
        redirects = []
        technologies = []
        findings = []

        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=15.0, verify=False
            ) as client:
                resp = await client.get(url)
                headers = dict(resp.headers)

                if resp.status_code >= 400 and not headers:
                    findings.append({
                        "type": "unreachable", "severity": "LOW",
                        "detail": f"Website returned HTTP {resp.status_code}",
                        "what_happened": f"Server responded with status {resp.status_code}.",
                        "why_it_matters": "The website may be down or misconfigured.",
                        "potential_impact": "Incomplete scan.",
                        "evidence": f"HTTP {resp.status_code}",
                        "recommendation": "Verify the URL is correct and the site is online.",
                    })
                    return ScanResult(url=url, headers=headers, security_headers={},
                        tls_info={}, cookies=[], redirects=[], technologies=[], findings=findings)

                security_header_names = [
                    "content-security-policy", "x-content-type-options",
                    "x-frame-options", "strict-transport-security",
                    "x-xss-protection", "referrer-policy", "permissions-policy",
                ]
                for sh in security_header_names:
                    security_headers[sh] = sh in headers

                for cookie in resp.cookies.items():
                    cookies.append({"name": cookie[0], "value": cookie[1][:20] + "..."})

                for r in resp.history:
                    redirects.append({"url": str(r.url), "status": r.status_code})

                server = headers.get("server", "")
                if server:
                    technologies.append({"type": "server", "value": server})

                powered_by = headers.get("x-powered-by", "")
                if powered_by:
                    technologies.append({"type": "framework", "value": powered_by})

                missing = [sh for sh, present in security_headers.items() if not present]
                if missing:
                    findings.append({
                        "type": "missing_security_headers", "severity": "MEDIUM",
                        "detail": f"Missing security headers: {', '.join(missing)}",
                        "what_happened": f"Website does not set these security headers: {', '.join(missing)}.",
                        "why_it_matters": "These headers protect against common attacks like XSS, clickjacking, and MIME sniffing.",
                        "potential_impact": "Increased attack surface if other vulnerabilities exist.",
                        "evidence": f"Missing: {', '.join(missing)}",
                        "recommendation": f"Add these headers: {', '.join(missing)}",
                    })

                parsed_url = urlparse(url)
                if parsed_url.scheme == "https":
                    tls_info = await self._check_tls(hostname)
                    if tls_info.get("expired"):
                        findings.append({
                            "type": "tls_issue", "severity": "HIGH",
                            "detail": "TLS certificate is expired",
                            "what_happened": "The SSL/TLS certificate has expired.",
                            "why_it_matters": "Users see security warnings. Encrypted connections cannot be trusted.",
                            "potential_impact": "Man-in-the-middle attacks, loss of user trust.",
                            "evidence": f"Expiry: {tls_info.get('notAfter', 'unknown')}",
                            "recommendation": "Renew the TLS certificate immediately.",
                        })
                    elif tls_info.get("notAfter"):
                        try:
                            from datetime import datetime
                            expiry = datetime.strptime(tls_info["notAfter"], "%b %d %H:%M:%S %Y %Z")
                            days_left = (expiry - datetime.utcnow()).days
                            if days_left < 30:
                                findings.append({
                                    "type": "tls_expiring", "severity": "MEDIUM",
                                    "detail": f"TLS certificate expires in {days_left} days",
                                    "what_happened": f"Certificate will expire in {days_left} days.",
                                    "why_it_matters": "An expired certificate will cause browser warnings.",
                                    "potential_impact": "Service disruption, loss of HTTPS.",
                                    "evidence": f"Expiry: {tls_info['notAfter']}",
                                    "recommendation": "Renew the certificate before expiry.",
                                })
                        except:
                            pass

                if not parsed_url.scheme == "https":
                    findings.append({
                        "type": "no_https", "severity": "HIGH",
                        "detail": "Website does not use HTTPS",
                        "what_happened": "Website served over plain HTTP without TLS.",
                        "why_it_matters": "All data transmitted is readable by anyone on the network.",
                        "potential_impact": "Credential theft, session hijacking, data interception.",
                        "evidence": f"URL scheme: {parsed_url.scheme}",
                        "recommendation": "Enable HTTPS with a valid TLS certificate.",
                    })

                exploit_findings = await self._check_web_exploits(client, url)
                findings.extend(exploit_findings)

                form_findings = await self._check_forms(client, url)
                findings.extend(form_findings)

        except httpx.ConnectError:
            findings.append({
                "type": "connection_failed", "severity": "LOW",
                "detail": f"Cannot connect to {hostname}",
                "what_happened": f"Connection to '{hostname}' was refused or timed out.",
                "why_it_matters": "The website is not accepting connections.",
                "potential_impact": "Scan cannot proceed.",
                "evidence": f"ConnectError for {hostname}",
                "recommendation": "Verify the domain is correct and the server is online.",
            })
        except Exception as e:
            findings.append({
                "type": "scan_error", "severity": "LOW",
                "detail": f"Scan error: {str(e)[:200]}",
                "what_happened": f"Scanner encountered an error: {str(e)[:200]}.",
                "why_it_matters": "Some checks could not be completed.",
                "potential_impact": "Incomplete security assessment.",
                "evidence": str(e)[:200],
                "recommendation": "Verify the target URL is accessible.",
            })

        return ScanResult(url=url, headers=headers, security_headers=security_headers,
            tls_info=tls_info, cookies=cookies, redirects=redirects,
            technologies=technologies, findings=findings)

    async def _check_web_exploits(self, client, url):
        findings = []
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        sqli_findings = await self._check_sqli(client, base)
        if sqli_findings:
            findings.extend(sqli_findings)

        xss_findings = await self._check_xss(client, base)
        if xss_findings:
            findings.extend(xss_findings)

        traversal_findings = await self._check_dir_traversal(client, base)
        if traversal_findings:
            findings.extend(traversal_findings)

        info_findings = await self._check_info_leaks(client, base)
        if info_findings:
            findings.extend(info_findings)

        cors_findings = await self._check_cors(client, base)
        if cors_findings:
            findings.extend(cors_findings)

        clickjacking_findings = await self._check_clickjacking(client, base)
        if clickjacking_findings:
            findings.extend(clickjacking_findings)

        cookie_findings = await self._check_cookie_security(client, url)
        if cookie_findings:
            findings.extend(cookie_findings)

        redirect_findings = await self._check_open_redirect(client, base)
        if redirect_findings:
            findings.extend(redirect_findings)

        crlf_findings = await self._check_crlf(client, base)
        if crlf_findings:
            findings.extend(crlf_findings)

        listing_findings = await self._check_directory_listing(client, base)
        if listing_findings:
            findings.extend(listing_findings)

        admin_findings = await self._check_admin_panels(client, base)
        if admin_findings:
            findings.extend(admin_findings)

        return findings

    async def _check_sqli(self, client, base):
        findings = []
        error_patterns = [
            "sql syntax", "mysql_fetch", "sqlite3.", "postgresql", "ORA-",
            "ODBC SQL Server", "unclosed quotation mark",
            "you have an error in your sql", "query failed",
            "mysql_num_rows", "pg_query", "sqlite_error",
            "warning: mysql", "valid mysql result",
        ]
        paths = ["/", "/login", "/search"]
        for path in paths:
            for payload in ["'", "1 OR 1=1", "' OR ''='"]:
                try:
                    resp = await client.get(base + path, params={"id": payload, "q": payload}, timeout=5.0)
                    body = resp.text.lower()
                    for pattern in error_patterns:
                        if pattern.lower() in body:
                            context_start = max(0, body.index(pattern.lower()) - 100)
                            context = body[context_start:context_start + 300]
                            if any(kw in context for kw in ["error", "exception", "warning", "fatal", "syntax"]):
                                findings.append({
                                    "type": "sqli_error", "severity": "CRITICAL",
                                    "detail": "SQL Injection vulnerability detected via error-based disclosure",
                                    "what_happened": f"SQL payload '{payload}' triggered a database error at {path}. The server leaked a raw database error message.",
                                    "why_it_matters": "Attacker can inject arbitrary SQL to read, modify, or delete data.",
                                    "potential_impact": "Database compromise, data theft, authentication bypass.",
                                    "evidence": f"URL: {base}{path} | Payload: {payload} | Error pattern: {pattern}",
                                    "recommendation": "Use parameterized queries/prepared statements. Never concatenate user input into SQL. Display generic error messages.",
                                })
                                return findings
                except:
                    continue
        return findings

    async def _check_xss(self, client, base):
        findings = []
        payloads = [
            ('<script>alert(1)</script>', '<script>alert(1)</script>'),
            ('<img src=x onerror=alert(1)>', 'onerror=alert(1)'),
        ]
        paths = ["/search", "/?q="]
        for path in paths:
            for payload, check in payloads:
                try:
                    resp = await client.get(base + path, params={"q": payload, "s": payload}, timeout=5.0)
                    if check in resp.text:
                        findings.append({
                            "type": "xss_reflected", "severity": "HIGH",
                            "detail": "Reflected XSS vulnerability detected",
                            "what_happened": f"XSS payload was reflected verbatim in the page at {path}. The input is not sanitized or encoded.",
                            "why_it_matters": "Attacker can inject malicious scripts to steal cookies, tokens, or redirect users.",
                            "potential_impact": "Session hijacking, credential theft, phishing.",
                            "evidence": f"URL: {base}{path} | Payload reflected in response HTML",
                            "recommendation": "Sanitize and HTML-encode all user input on output. Implement CSP header.",
                        })
                        return findings
                except:
                    continue
        return findings

    async def _check_dir_traversal(self, client, base):
        findings = []
        for path in ["/", "/file?name="]:
            try:
                resp = await client.get(base + path, params={"name": "../../../etc/passwd", "id": "../../../etc/passwd"}, timeout=5.0)
                if "root:x:" in resp.text or "daemon:" in resp.text:
                    findings.append({
                        "type": "directory_traversal", "severity": "CRITICAL",
                        "detail": "Directory/path traversal vulnerability detected",
                        "what_happened": f"Traversal payload accessed /etc/passwd at {path}.",
                        "why_it_matters": "Attacker can read arbitrary files on the server.",
                        "potential_impact": "Sensitive file disclosure, credential theft, server compromise.",
                        "evidence": f"URL: {base}{path} | /etc/passwd content found in response",
                        "recommendation": "Validate and sanitize file paths. Never use user input in file operations.",
                    })
                    return findings
            except:
                continue
        return findings

    async def _check_info_leaks(self, client, base):
        findings = []
        sensitive_paths = [
            ("/.env", "CRITICAL", "Environment file (.env) exposed",
             "The .env file with database passwords and API keys is publicly accessible.",
             "Full application compromise, database access."),
            ("/.git/config", "HIGH", "Git repository exposed",
             "The .git/config file is publicly accessible.",
             "Source code disclosure, secret exposure."),
            ("/.git/HEAD", "HIGH", "Git repository exposed",
             "The .git/HEAD file is publicly accessible.",
             "Source code disclosure."),
            ("/phpinfo.php", "HIGH", "PHP info page exposed",
             "phpinfo() page leaks server configuration.",
             "Information disclosure aiding further attacks."),
            ("/backup.sql", "CRITICAL", "Database backup file exposed",
             "A database backup file is publicly accessible.",
             "Full data breach."),
            ("/.htaccess", "HIGH", "Apache .htaccess exposed",
             ".htaccess file is accessible via web.",
             "Configuration disclosure."),
            ("/config.php", "CRITICAL", "Config file exposed",
             "A config.php file is accessible via web.",
             "Full application compromise."),
        ]
        for path, sev, detail, what, impact in sensitive_paths:
            try:
                resp = await client.get(base + path, timeout=5.0, follow_redirects=False)
                if resp.status_code == 200 and len(resp.text) > 10:
                    body = resp.text.lower()
                    is_valid = True
                    if path == "/.env" and "=" not in body:
                        is_valid = False
                    if path == "/.git/config" and "repositoryformatversion" not in body:
                        is_valid = False
                    if path == "/.git/HEAD" and "ref:" not in body:
                        is_valid = False
                    if is_valid:
                        findings.append({
                            "type": "sensitive_file_exposure", "severity": sev,
                            "detail": detail, "what_happened": what,
                            "why_it_matters": what, "potential_impact": impact,
                            "evidence": f"URL: {base}{path} returned HTTP {resp.status_code}",
                            "recommendation": f"Block access to {path} via web server configuration.",
                        })
            except:
                continue
        return findings

    async def _check_cors(self, client, base):
        findings = []
        try:
            resp = await client.get(base, headers={"Origin": "https://evil.com"}, timeout=5.0)
            acao = resp.headers.get("access-control-allow-origin", "")
            if acao == "https://evil.com":
                findings.append({
                    "type": "cors_misconfiguration", "severity": "CRITICAL",
                    "detail": "CORS reflects arbitrary origins",
                    "what_happened": "Server reflects attacker-controlled Origin header in Access-Control-Allow-Origin.",
                    "why_it_matters": "Any attacker website can make authenticated cross-origin requests.",
                    "potential_impact": "Data theft, account takeover, CSRF bypass.",
                    "evidence": f"Access-Control-Allow-Origin: {acao}",
                    "recommendation": "Validate and whitelist allowed origins. Never reflect arbitrary origins.",
                })
            elif acao == "*":
                findings.append({
                    "type": "cors_misconfiguration", "severity": "MEDIUM",
                    "detail": "CORS allows any origin (*)",
                    "what_happened": "Server responds with Access-Control-Allow-Origin: *.",
                    "why_it_matters": "Any website can make cross-origin requests on behalf of users.",
                    "potential_impact": "CSRF attacks, data theft from authenticated endpoints.",
                    "evidence": f"Access-Control-Allow-Origin: {acao}",
                    "recommendation": "Restrict CORS to specific trusted origins.",
                })
        except:
            pass
        return findings

    async def _check_clickjacking(self, client, base):
        findings = []
        try:
            resp = await client.get(base, timeout=5.0)
            xfo = resp.headers.get("x-frame-options", "")
            csp = resp.headers.get("content-security-policy", "")
            if not xfo and "frame-ancestors" not in csp:
                findings.append({
                    "type": "clickjacking", "severity": "MEDIUM",
                    "detail": "Website is vulnerable to clickjacking",
                    "what_happened": "No X-Frame-Options or CSP frame-ancestors directive found.",
                    "why_it_matters": "Attacker can embed the site in an invisible iframe to trick users.",
                    "potential_impact": "Phishing, unauthorized actions via clickjacking.",
                    "evidence": "Missing X-Frame-Options and CSP frame-ancestors",
                    "recommendation": "Set X-Frame-Options: DENY or SAMEORIGIN.",
                })
        except:
            pass
        return findings

    async def _check_cookie_security(self, client, url):
        findings = []
        try:
            resp = await client.get(url, timeout=5.0)
            for cookie_header in resp.headers.get_list("set-cookie"):
                cl = cookie_header.lower()
                if "session" in cl or "token" in cl or "auth" in cl:
                    issues = []
                    if "httponly" not in cl:
                        issues.append("HttpOnly")
                    if "secure" not in cl:
                        issues.append("Secure")
                    if "samesite" not in cl:
                        issues.append("SameSite")
                    if issues:
                        findings.append({
                            "type": "cookie_security", "severity": "MEDIUM",
                            "detail": f"Session cookie missing flags: {', '.join(issues)}",
                            "what_happened": f"Session cookie lacks {', '.join(issues)} flags.",
                            "why_it_matters": "Cookies without these flags can be stolen via XSS or sent cross-site.",
                            "potential_impact": "Session hijacking, CSRF attacks.",
                            "evidence": f"Set-Cookie: {cookie_header[:200]}",
                            "recommendation": "Set HttpOnly, Secure, and SameSite on session cookies.",
                        })
                        break
        except:
            pass
        return findings

    async def _check_open_redirect(self, client, base):
        findings = []
        for path in ["/redirect", "/login"]:
            for param in ["?url=", "?redirect=", "?next="]:
                try:
                    resp = await client.get(base + path + param + "https://evil.com", timeout=5.0, follow_redirects=False)
                    location = resp.headers.get("location", "")
                    if "evil.com" in location:
                        findings.append({
                            "type": "open_redirect", "severity": "MEDIUM",
                            "detail": "Open redirect vulnerability detected",
                            "what_happened": f"Redirect at {path}{param} points to attacker-controlled domain.",
                            "why_it_matters": "Attacker can redirect victims to phishing sites.",
                            "potential_impact": "Phishing, OAuth token theft.",
                            "evidence": f"Redirect to {location}",
                            "recommendation": "Validate redirect URLs against a whitelist.",
                        })
                        return findings
                except:
                    continue
        return findings

    async def _check_crlf(self, client, base):
        findings = []
        try:
            resp = await client.get(base + "/?q=%0d%0aInjected-Header:nesti", timeout=5.0, follow_redirects=False)
            for _, value in resp.headers.items():
                if "nesti" in value.lower():
                    findings.append({
                        "type": "crlf_injection", "severity": "HIGH",
                        "detail": "CRLF/Header injection vulnerability detected",
                        "what_happened": "Injected newline characters allowed setting arbitrary response headers.",
                        "why_it_matters": "Attacker can inject response headers including Set-Cookie and redirects.",
                        "potential_impact": "Session fixation, XSS, cache poisoning.",
                        "evidence": f"Injected header found: {value}",
                        "recommendation": "Sanitize input to remove CR/LF characters.",
                    })
                    return findings
        except:
            pass
        return findings

    async def _check_directory_listing(self, client, base):
        findings = []
        for d in ["/images/", "/uploads/", "/files/", "/static/"]:
            try:
                resp = await client.get(base + d, timeout=5.0)
                body = resp.text.lower()
                if resp.status_code == 200 and ("index of" in body or "directory listing" in body):
                    findings.append({
                        "type": "directory_listing", "severity": "MEDIUM",
                        "detail": f"Directory listing enabled at {d}",
                        "what_happened": f"Directory {d} shows a full file listing.",
                        "why_it_matters": "Attackers can browse and download all files.",
                        "potential_impact": "Information disclosure, source code leakage.",
                        "evidence": f"URL: {base}{d} returned directory listing",
                        "recommendation": "Disable directory listing in web server configuration.",
                    })
                    return findings
            except:
                continue
        return findings

    async def _check_admin_panels(self, client, base):
        findings = []
        found = []
        for path in ["/admin", "/wp-admin", "/phpmyadmin", "/administrator", "/login"]:
            try:
                resp = await client.get(base + path, timeout=5.0, follow_redirects=True)
                if resp.status_code in [200, 301, 302, 401, 403]:
                    body = resp.text.lower()
                    if any(sig in body for sig in ["login", "password", "username", "admin", "sign in"]):
                        found.append(path)
            except:
                continue
        if found:
            findings.append({
                "type": "admin_panel_exposed", "severity": "MEDIUM",
                "detail": f"Admin panel(s) accessible: {', '.join(found)}",
                "what_happened": f"Found {len(found)} admin login panel(s) accessible from the internet.",
                "why_it_matters": "Exposed admin panels are targets for brute-force attacks.",
                "potential_impact": "Unauthorized admin access.",
                "evidence": f"Found: {', '.join(found)}",
                "recommendation": "Restrict admin panel access to internal networks or VPN.",
            })
        return findings

    async def _check_tls(self, hostname):
        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
                s.settimeout(5)
                s.connect((hostname, 443))
                cert = s.getpeercert()
                cipher = s.cipher()
                return {
                    "subject": dict(x[0] for x in cert.get("subject", [])),
                    "issuer": dict(x[0] for x in cert.get("issuer", [])),
                    "notAfter": cert.get("notAfter", ""),
                    "expired": False,
                    "cipher": cipher[0] if cipher else "",
                    "protocol": cipher[1] if cipher else "",
                }
        except ssl.SSLCertVerificationError:
            return {"expired": True, "error": "Certificate verification failed"}
        except Exception as e:
            return {"error": str(e)[:200]}

    async def _check_forms(self, client, url):
        findings = []
        try:
            resp = await client.get(url, timeout=10.0)
            html = resp.text
            forms = re.findall(r'<form[^>]*>(.*?)</form>', html, re.DOTALL | re.IGNORECASE)
            if not forms:
                return findings

            for form_html in forms:
                fl = form_html.lower()
                has_password = bool(re.search(r'type=["\']password["\']', fl))
                has_csrf = bool(re.search(r'name=["\'](?:csrf|_token|csrfmiddlewaretoken|authenticity_token)["\']', fl))
                has_captcha = bool(re.search(r'captcha|recaptcha|hcaptcha', fl))
                method_match = re.search(r'method=["\']([^"\']*)["\']', form_html, re.IGNORECASE)
                method = method_match.group(1).upper() if method_match else "GET"

                if has_password and method == "GET":
                    findings.append({
                        "type": "insecure_login_method", "severity": "HIGH",
                        "detail": "Login form uses GET method",
                        "what_happened": "A login form sends credentials via GET. Credentials appear in URLs and server logs.",
                        "why_it_matters": "Credentials in URLs are logged and can be leaked via Referer headers.",
                        "potential_impact": "Credential exposure through logs and browser history.",
                        "evidence": f"Login form method: GET",
                        "recommendation": "Change the login form method to POST. Always use HTTPS.",
                    })

                if method == "POST" and not has_csrf:
                    findings.append({
                        "type": "missing_csrf_token", "severity": "MEDIUM",
                        "detail": "POST form missing CSRF token",
                        "what_happened": "A POST form has no CSRF protection. Attacker can submit it on behalf of users.",
                        "why_it_matters": "Without CSRF tokens, attacker can craft pages that submit forms for authenticated users.",
                        "potential_impact": "CSRF attacks: unauthorized actions, data modification.",
                        "evidence": f"POST form without CSRF token",
                        "recommendation": "Add anti-CSRF tokens to all POST forms.",
                    })

                if has_password and not has_captcha:
                    findings.append({
                        "type": "no_captcha", "severity": "MEDIUM",
                        "detail": "Login form lacks CAPTCHA protection",
                        "what_happened": "Login form has no CAPTCHA. Automated brute-force attacks can proceed unchecked.",
                        "why_it_matters": "Without CAPTCHA, credential stuffing attacks can succeed.",
                        "potential_impact": "Account takeover via automated attacks.",
                        "evidence": "Login form without CAPTCHA detected",
                        "recommendation": "Add CAPTCHA and implement server-side rate limiting.",
                    })
                    break

        except:
            pass
        return findings
