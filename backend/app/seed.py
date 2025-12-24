"""
Database seeding script for demo data.
Creates demo users and sample posts/comments/likes for testing.
"""

import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import Comment, Like, Post, User
from app.services.auth import get_password_hash

# Demo users with their credentials
DEMO_USERS = [
    {
        "username": "demo",
        "email": "demo@example.com",
        "password": "demo123",
        "display_name": "Demo User",
        "bio": "This is a demo account. Feel free to explore!",
    },
    {
        "username": "alice",
        "email": "alice@example.com",
        "password": "alice123",
        "display_name": "Alice Johnson",
        "bio": "Software engineer | Coffee enthusiast | Building cool things",
    },
    {
        "username": "bob",
        "email": "bob@example.com",
        "password": "bob123",
        "display_name": "Bob Smith",
        "bio": "Tech blogger and open source contributor",
    },
    {
        "username": "charlie",
        "email": "charlie@example.com",
        "password": "charlie123",
        "display_name": "Charlie Brown",
        "bio": "Designer | Creative thinker | Dog lover 🐕",
    },
]

# Sample posts content
SAMPLE_POSTS = [
    "Just deployed my first FastAPI application! The documentation is amazing 🚀",
    "Working on a new React project with Tailwind CSS. The developer experience is fantastic!",
    "Who else loves coding late at night with some lo-fi music? 🎵",
    "TIL: You can use Docker Compose profiles to manage different environments. Game changer!",
    "Finally figured out WebSockets. Real-time features are so satisfying to build!",
    "Coffee count today: ☕☕☕☕ (send help)",
    "Just finished reading 'Clean Code'. Highly recommend it to all developers!",
    "PostgreSQL is underrated. The performance optimizations you can do are incredible.",
    "Hot take: TypeScript makes JavaScript actually enjoyable to write.",
    "Pair programming session was super productive today. Two minds > one mind!",
    "Remember to take breaks! Your code will thank you later. 🧘‍♂️",
    "Just discovered Vite and wow, the build times are insanely fast!",
]

# Sample comments
SAMPLE_COMMENTS = [
    "Great post! Totally agree with this.",
    "Thanks for sharing! This is really helpful.",
    "I had the same experience! 😄",
    "Interesting perspective!",
    "This is exactly what I needed to hear today.",
    "Love this! Keep posting more content like this.",
    "So true! Well said.",
    "Adding this to my reading list!",
    "This made my day!",
    "Couldn't agree more! 💯",
]


def seed_database(db: Session) -> dict:
    """
    Seed the database with demo data.
    Returns a summary of what was created.
    """
    created = {"users": 0, "posts": 0, "comments": 0, "likes": 0}

    # Check if demo user already exists
    existing_demo = db.query(User).filter(User.username == "demo").first()
    if existing_demo:
        print("Demo data already exists. Skipping seed.")
        return created

    print("Seeding database with demo data...")

    # Create users
    users = []
    for user_data in DEMO_USERS:
        user = User(
            username=user_data["username"],
            email=user_data["email"],
            hashed_password=get_password_hash(user_data["password"]),
            display_name=user_data["display_name"],
            bio=user_data["bio"],
            is_active=True,
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
        )
        db.add(user)
        users.append(user)
        created["users"] += 1

    db.flush()  # Get user IDs

    # Create posts
    posts = []
    base_time = datetime.utcnow()

    for i, content in enumerate(SAMPLE_POSTS):
        author = random.choice(users)
        post = Post(
            content=content,
            author_id=author.id,
            created_at=base_time - timedelta(hours=i * 2 + random.randint(0, 5)),
        )
        db.add(post)
        posts.append(post)
        created["posts"] += 1

    db.flush()  # Get post IDs

    # Create comments (2-4 comments per post on some posts)
    for post in random.sample(posts, min(8, len(posts))):
        num_comments = random.randint(2, 4)
        comment_time = post.created_at

        for _ in range(num_comments):
            commenter = random.choice(users)
            comment_time = comment_time + timedelta(minutes=random.randint(5, 120))

            comment = Comment(
                content=random.choice(SAMPLE_COMMENTS),
                author_id=commenter.id,
                post_id=post.id,
                created_at=comment_time,
            )
            db.add(comment)
            created["comments"] += 1

    db.flush()

    # Create likes (random likes on posts)
    liked_pairs = set()  # Track (user_id, post_id) to avoid duplicates

    for post in posts:
        # Each post gets 0-3 likes from random users
        num_likes = random.randint(0, min(3, len(users)))
        potential_likers = [u for u in users if u.id != post.author_id]
        likers = random.sample(potential_likers, min(num_likes, len(potential_likers)))

        for liker in likers:
            pair = (liker.id, post.id)
            if pair not in liked_pairs:
                like = Like(
                    user_id=liker.id,
                    post_id=post.id,
                    created_at=post.created_at
                    + timedelta(minutes=random.randint(1, 60)),
                )
                db.add(like)
                liked_pairs.add(pair)
                created["likes"] += 1

    db.commit()

    print(f"Seed complete! Created:")
    print(f"  - {created['users']} users")
    print(f"  - {created['posts']} posts")
    print(f"  - {created['comments']} comments")
    print(f"  - {created['likes']} likes")
    print()
    print("Demo credentials:")
    print("  Username: demo")
    print("  Password: demo123")
    print()
    print("Other test accounts: alice/alice123, bob/bob123, charlie/charlie123")

    return created


def run_seed():
    """Run the seed function with a database session."""
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
