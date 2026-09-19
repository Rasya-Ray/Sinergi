import math
import re
from typing import Any


class PasswordService:
    COMMON_PASSWORDS = {
        "password", "123456", "12345678", "qwerty", "abc123", "monkey", "master",
        "dragon", "letmein", "login", "princess", "football", "shadow", "sunshine",
        "trustno1", "iloveyou", "batman", "access", "hello", "charlie", "password1",
        "admin", "welcome", "passw0rd", "p@ssword", "p@ssw0rd",
    }

    def check(self, password: str) -> dict[str, Any]:
        score = 0
        feedback = []

        if password.lower() in self.COMMON_PASSWORDS:
            return {
                "score": 0,
                "strength": "Very Weak",
                "crack_time": "Instant",
                "feedback": ["This is a commonly used password."],
                "entropy": 0,
                "length": len(password),
            }

        length = len(password)
        if length >= 8: score += 1
        if length >= 12: score += 1
        if length >= 16: score += 1
        if length < 8: feedback.append("Use at least 8 characters.")

        if re.search(r"[a-z]", password): score += 1
        else: feedback.append("Add lowercase letters.")
        if re.search(r"[A-Z]", password): score += 1
        else: feedback.append("Add uppercase letters.")
        if re.search(r"\d", password): score += 1
        else: feedback.append("Add numbers.")
        if re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password): score += 1
        else: feedback.append("Add special characters.")

        unique_chars = len(set(password))
        if unique_chars >= 8: score += 1
        if unique_chars < length * 0.5: feedback.append("Avoid repeating characters.")

        entropy = self._calculate_entropy(password)
        crack_time = self._estimate_crack_time(entropy)

        strength = "Very Weak"
        if score >= 8: strength = "Very Strong"
        elif score >= 6: strength = "Strong"
        elif score >= 4: strength = "Medium"
        elif score >= 2: strength = "Weak"

        return {
            "score": min(score, 9),
            "strength": strength,
            "crack_time": crack_time,
            "feedback": feedback,
            "entropy": round(entropy, 1),
            "length": length,
            "unique_chars": unique_chars,
        }

    def _calculate_entropy(self, password: str) -> float:
        charset_size = 0
        if re.search(r"[a-z]", password): charset_size += 26
        if re.search(r"[A-Z]", password): charset_size += 26
        if re.search(r"\d", password): charset_size += 10
        if re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password): charset_size += 32
        if charset_size == 0: charset_size = 26
        return len(password) * math.log2(charset_size)

    def _estimate_crack_time(self, entropy: float) -> str:
        guesses_per_second = 1e10
        total_guesses = 2 ** entropy
        seconds = total_guesses / guesses_per_second / 2

        if seconds < 1: return "Instant"
        if seconds < 60: return f"{int(seconds)} seconds"
        if seconds < 3600: return f"{int(seconds/60)} minutes"
        if seconds < 86400: return f"{int(seconds/3600)} hours"
        if seconds < 31536000: return f"{int(seconds/86400)} days"
        years = seconds / 31536000
        if years < 1000: return f"{int(years)} years"
        if years < 1e6: return f"{int(years/1000)}K years"
        if years < 1e9: return f"{int(years/1e6)}M years"
        return f"{int(years/1e9)}B+ years"
