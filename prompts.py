"""Bank of random speaking prompts for daily 1-minute practice sessions."""

import random

PROMPTS = [
    # Personal / reflective
    "Describe a moment you changed your mind about something important.",
    "Talk about a time you failed at something and what you learned.",
    "Describe your ideal ordinary day, from morning to night.",
    "Talk about a habit you're trying to build or break.",
    "Describe a person who influenced how you think.",
    "Talk about a decision you're proud of.",
    "Describe a place that feels like home to you.",
    "Talk about something you believed as a kid that turned out to be wrong.",
    "Describe how you handle stress.",
    "Talk about a risk you took and how it turned out.",

    # Explain a concept
    "Explain your job to a 10-year-old.",
    "Explain how the internet works, in simple terms.",
    "Explain why the sky is blue.",
    "Explain a skill you have to someone who knows nothing about it.",
    "Explain the difference between confidence and arrogance.",
    "Explain how compound interest works.",
    "Explain what makes a good leader.",
    "Explain a rule you think should be changed.",

    # Opinion / persuasion
    "Argue for or against a 4-day work week.",
    "Convince someone to try your favorite hobby.",
    "Argue why your favorite book or movie is worth everyone's time.",
    "Make the case for or against social media.",
    "Argue whether money can buy happiness.",
    "Make the case for trying something new versus sticking with what works.",
    "Argue for or against remote work.",
    "Convince a skeptic that failure is valuable.",

    # Storytelling / hypothetical
    "Tell a story about the best meal you've ever had.",
    "Describe what you'd do with an unexpected free week.",
    "Tell a story about getting lost.",
    "Describe your perfect vacation.",
    "Tell a story about a time you helped someone.",
    "Describe what your life might look like in 10 years.",
    "Tell a story about a mistake that turned into something good.",
    "Describe what you would do if you won the lottery.",
    "Tell a story about the last time you laughed really hard.",
    "Describe an invention you wish existed.",

    # Quick-fire / warm-up
    "Describe your morning routine.",
    "Talk about what you had for breakfast and why.",
    "Describe the view from your window.",
    "Talk about your favorite season and why.",
    "Describe what's on your desk right now.",
    "Talk about a song that means something to you.",
]


def get_random_prompt(exclude: list[str] | None = None) -> str:
    """Return a random prompt, avoiding recently used ones when possible."""
    exclude = exclude or []
    candidates = [p for p in PROMPTS if p not in exclude]
    if not candidates:
        candidates = PROMPTS
    return random.choice(candidates)
