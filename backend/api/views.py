from django.http import JsonResponse
from django.db import connection
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from datetime import timedelta
from django.utils import timezone
import json
import os
import uuid


CATEGORY_NAME_MAP = {
    "campus-events-general": "General Events",
    "campus-events-sports": "Sports & Athletics",
    "campus-events-cultural": "Cultural Events",
    "campus-events-workshops": "Workshops & Seminars",
    "jobs-internships-tech": "Tech Jobs",
    "jobs-internships-business": "Business & Finance",
    "jobs-internships-research": "Research Positions",
    "jobs-internships-oncampus": "On-Campus Jobs",
    "academics-datascience": "Data Science",
    "academics-engineering": "Engineering",
    "academics-business": "Business",
    "academics-arts": "Arts & Humanities",
    "announcements-admin": "Administrative",
    "announcements-safety": "Safety & Security",
    "announcements-facilities": "Facilities",
    "announcements-policy": "Policy Updates",
    "research-stem": "STEM Research",
    "research-social": "Social Sciences",
    "research-medical": "Medical & Health",
    "research-opportunities": "Research Opportunities",
}


def normalize_category_name(category):
    return CATEGORY_NAME_MAP.get(category, category)


def has_topic_upvote_support():
    cursor = connection.cursor()
    cursor.execute("SHOW COLUMNS FROM UPVOTE LIKE 'TOPIC_ID'")
    return cursor.fetchone() is not None


def has_table(table_name):
    cursor = connection.cursor()
    cursor.execute("SHOW TABLES LIKE %s", [table_name])
    return cursor.fetchone() is not None


def has_class_feature_support():
    required_tables = [
        "CLASSROOM",
        "CLASS_ENROLLMENT",
        "CLASS_DISCUSSION",
        "CLASS_DISCUSSION_REPLY",
        "CLASS_DISCUSSION_VOTE",
    ]
    return all(has_table(table_name) for table_name in required_tables)


def ensure_class_resource_support():
    if not has_class_feature_support():
        return

    cursor = connection.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS CLASS_RESOURCE (
            RESOURCE_ID INT AUTO_INCREMENT PRIMARY KEY,
            CLASS_ID INT NOT NULL,
            TITLE VARCHAR(255) NOT NULL,
            DESCRIPTION TEXT NULL,
            RESOURCE_TYPE VARCHAR(30) NOT NULL DEFAULT 'material',
            RESOURCE_URL TEXT NULL,
            FILE_PATH VARCHAR(500) NULL,
            IS_PINNED TINYINT(1) DEFAULT 0,
            CREATED_BY INT NOT NULL,
            CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)


def ensure_user_profile_support():
    if not has_table("USER"):
        return

    cursor = connection.cursor()
    profile_columns = [
        ("BIO", "TEXT NULL"),
        ("DEPARTMENT", "VARCHAR(150) NULL"),
        ("OFFICE_ADDRESS", "VARCHAR(255) NULL"),
        ("OFFICE_HOURS", "VARCHAR(255) NULL"),
        ("INTERESTS_JSON", "TEXT NULL"),
        ("ACADEMIC_INTERESTS_JSON", "TEXT NULL"),
        ("NOTIFICATION_PREFERENCES_JSON", "TEXT NULL"),
        ("VERIFIED_ROLE", "TINYINT(1) DEFAULT 1"),
        ("VERIFIED_DEPARTMENT", "TINYINT(1) DEFAULT 0"),
    ]

    for column_name, column_definition in profile_columns:
        if not has_column("USER", column_name):
            cursor.execute(f"""
                ALTER TABLE USER
                ADD COLUMN {column_name} {column_definition}
            """)


def has_column(table_name, column_name):
    cursor = connection.cursor()
    cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE %s", [column_name])
    return cursor.fetchone() is not None


def topic_cover_column_name():
    if has_column("TOPIC", "COVER_IMAGE_PATH"):
        return "COVER_IMAGE_PATH"
    if has_column("TOPIC", "COVER_IMAGE_URL"):
        return "COVER_IMAGE_URL"
    return None


def build_media_url(path_value):
    if not path_value:
        return None
    if str(path_value).startswith("http://") or str(path_value).startswith("https://"):
        return path_value
    normalized = f"/{str(path_value).lstrip('/')}"
    return normalized


def save_uploaded_cover_image(file_obj):
    return save_uploaded_media(file_obj, "topic_covers")


def save_uploaded_media(file_obj, relative_dir):
    if not file_obj:
        return None

    file_root, file_ext = os.path.splitext(file_obj.name or "")
    safe_ext = file_ext.lower() if file_ext else ".jpg"
    file_name = f"{uuid.uuid4().hex}{safe_ext}"
    absolute_dir = os.path.join(settings.MEDIA_ROOT, relative_dir)
    os.makedirs(absolute_dir, exist_ok=True)
    relative_path = os.path.join(relative_dir, file_name).replace("\\", "/")
    absolute_path = os.path.join(settings.MEDIA_ROOT, relative_path)

    with open(absolute_path, "wb+") as destination:
        for chunk in file_obj.chunks():
            destination.write(chunk)

    return f"{settings.MEDIA_URL.rstrip('/')}/{relative_path}"


def build_class_resource_payload(row):
    (
        resource_id,
        class_id,
        title,
        description,
        resource_type,
        resource_url,
        file_path,
        is_pinned,
        created_by,
        first_name,
        last_name,
        created_at,
    ) = row

    return {
        "id": str(resource_id),
        "classId": str(class_id),
        "title": title,
        "description": description or "",
        "resourceType": resource_type or "material",
        "resourceUrl": resource_url or "",
        "fileUrl": build_media_url(file_path),
        "isPinned": bool(is_pinned),
        "createdBy": str(created_by),
        "createdByName": f"{first_name} {last_name}".strip(),
        "createdAt": created_at,
    }


def parse_json_text(raw_value, default_value):
    if raw_value in (None, ""):
        return default_value
    try:
        return json.loads(raw_value)
    except Exception:
        return default_value


def normalized_notification_preferences(raw_value=None):
    base = {
        "approvals": True,
        "replies": True,
        "classActivity": True,
        "moderation": True,
        "digestFrequency": "daily",
        "emailStyleSummary": True,
    }
    parsed = parse_json_text(raw_value, {})
    if isinstance(parsed, dict):
        base.update(parsed)
    return base


def build_user_payload_from_row(row):
    (
        user_id,
        first_name,
        last_name,
        email,
        role,
        status,
        is_active,
        contact_info,
        bio,
        department,
        office_address,
        office_hours,
        interests_json,
        academic_interests_json,
        notification_preferences_json,
        verified_role,
        verified_department,
    ) = row

    return {
        "id": str(user_id),
        "firstName": first_name or "",
        "lastName": last_name or "",
        "name": f"{first_name or ''} {last_name or ''}".strip(),
        "email": email,
        "role": (role or "student"),
        "status": status or "approved",
        "isActive": bool(is_active),
        "phoneNumber": contact_info or "",
        "bio": bio or "",
        "department": department or "",
        "officeAddress": office_address or "",
        "officeHours": office_hours or "",
        "interests": parse_json_text(interests_json, []),
        "academicInterests": parse_json_text(academic_interests_json, []),
        "notificationPreferences": normalized_notification_preferences(notification_preferences_json),
        "verifiedRole": bool(verified_role if verified_role is not None else 1),
        "verifiedDepartment": bool(verified_department),
    }


def validate_topic_payload(title, content, category, user_id):
    if not str(title or "").strip():
        return "Title field should be filled"
    if not str(content or "").strip():
        return "Content field should be filled"
    if not str(category or "").strip():
        return "Category field should be filled"
    if not str(user_id or "").strip():
        return "User field should be filled"
    return None


def ensure_topic_request_support_tables():
    cursor = connection.cursor()
    if not has_table("TOPIC_REQUEST_META"):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS TOPIC_REQUEST_META (
                TOPIC_ID INT PRIMARY KEY,
                PROOF_TEXT TEXT NULL,
                ADMIN_FEEDBACK TEXT NULL,
                UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
    if not has_table("TOPIC_REQUEST_TIMELINE"):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS TOPIC_REQUEST_TIMELINE (
                TIMELINE_ID INT AUTO_INCREMENT PRIMARY KEY,
                TOPIC_ID INT NOT NULL,
                EVENT_TYPE VARCHAR(50) NOT NULL,
                EVENT_MESSAGE TEXT NOT NULL,
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    if not has_table("CONTENT_REPORT"):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS CONTENT_REPORT (
                REPORT_ID INT AUTO_INCREMENT PRIMARY KEY,
                REPORTER_ID INT NOT NULL,
                TARGET_TYPE VARCHAR(20) NOT NULL,
                TARGET_ID INT NOT NULL,
                REASON VARCHAR(255) NOT NULL,
                DETAILS TEXT NULL,
                STATUS VARCHAR(20) DEFAULT 'pending',
                REVIEW_NOTES TEXT NULL,
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                REVIEWED_AT TIMESTAMP NULL DEFAULT NULL
            )
        """)
    if has_table("CONTENT_REPORT") and not has_column("CONTENT_REPORT", "ASSIGNED_ADMIN_ID"):
        cursor.execute("""
            ALTER TABLE CONTENT_REPORT
            ADD COLUMN ASSIGNED_ADMIN_ID INT NULL
        """)
    if not has_table("ADMIN_ACTIVITY_LOG"):
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ADMIN_ACTIVITY_LOG (
                LOG_ID INT AUTO_INCREMENT PRIMARY KEY,
                ADMIN_USER_ID INT NULL,
                ACTION_TYPE VARCHAR(50) NOT NULL,
                TARGET_TYPE VARCHAR(30) NOT NULL,
                TARGET_ID INT NULL,
                DESCRIPTION TEXT NOT NULL,
                CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)


def upsert_topic_request_meta(topic_id, proof_text=None, admin_feedback=None):
    ensure_topic_request_support_tables()
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO TOPIC_REQUEST_META (TOPIC_ID, PROOF_TEXT, ADMIN_FEEDBACK)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE
            PROOF_TEXT = COALESCE(VALUES(PROOF_TEXT), PROOF_TEXT),
            ADMIN_FEEDBACK = VALUES(ADMIN_FEEDBACK),
            UPDATED_AT = CURRENT_TIMESTAMP
    """, [topic_id, proof_text, admin_feedback])


def add_topic_request_timeline(topic_id, event_type, event_message):
    ensure_topic_request_support_tables()
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO TOPIC_REQUEST_TIMELINE (TOPIC_ID, EVENT_TYPE, EVENT_MESSAGE)
        VALUES (%s, %s, %s)
    """, [topic_id, event_type, event_message])


def log_admin_activity(admin_user_id, action_type, target_type, target_id, description):
    ensure_topic_request_support_tables()
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO ADMIN_ACTIVITY_LOG (ADMIN_USER_ID, ACTION_TYPE, TARGET_TYPE, TARGET_ID, DESCRIPTION)
        VALUES (%s, %s, %s, %s, %s)
    """, [admin_user_id, action_type, target_type, target_id, description])


def build_class_payload(row):
    (
        class_id,
        class_code,
        subject_name,
        department,
        instructor_id,
        first_name,
        last_name,
        semester,
        description,
        created_at,
        days,
        timings,
        class_area,
        enrolled_count,
        discussion_count,
        is_enrolled,
        has_pending_request,
    ) = row

    description_value = description or ""
    delivery_mode = None
    if description_value.startswith("[MODE:") and "]" in description_value:
        prefix, _, remaining = description_value.partition("]\n")
        delivery_mode = prefix.replace("[MODE:", "").replace("]", "").strip().lower()
        description_value = remaining if remaining else description_value.split("]", 1)[-1].strip()

    return {
        "id": str(class_id),
        "code": class_code,
        "name": subject_name,
        "department": department or "General",
        "instructorId": str(instructor_id),
        "instructorName": f"{first_name} {last_name}".strip(),
        "semester": semester or "Spring 2026",
        "deliveryMode": delivery_mode,
        "description": description_value,
        "createdAt": created_at,
        "discussionCount": int(discussion_count or 0),
        "days": [day.strip() for day in (days or "To Be Announced").split(",") if day.strip()],
        "time": timings or "To Be Announced",
        "location": class_area,
        "enrolledStudents": ["approved"] * int(enrolled_count or 0),
        "enrolledCount": int(enrolled_count or 0),
        "isEnrolled": bool(is_enrolled),
        "hasPendingRequest": bool(has_pending_request),
    }


def build_notification_payload(row):
    notification_id, user_id, content, is_read, created_at = row

    notification_type = "general"
    title = "Notification"
    message = content
    related_id = None

    if isinstance(content, str) and "|" in content:
        parts = content.split("|", 2)
        if len(parts) == 3:
            notification_type, related_id, message = parts
            if notification_type == "topic_request_approved":
                title = "Topic Request Approved!"
            elif notification_type == "topic_request_rejected":
                title = "Topic Request Rejected"
            elif notification_type == "topic_request_more_info":
                title = "More Information Requested"
            elif notification_type == "topic_comment_posted":
                title = "New Comment on Your Topic"
            elif notification_type == "comment_reply_posted":
                title = "New Reply to Your Comment"
            elif notification_type == "class_topic_posted":
                title = "New Class Topic"
            elif notification_type == "class_reply_posted":
                title = "New Class Reply"
            elif notification_type == "reported_reply_notice":
                title = "Reported Reply in Your Topic"
            elif notification_type == "reported_topic_notice":
                title = "Reported Topic Notice"

    return {
        "id": str(notification_id),
        "userId": str(user_id),
        "type": notification_type,
        "title": title,
        "message": message,
        "relatedId": str(related_id) if related_id not in (None, "") else None,
        "createdAt": created_at,
        "read": bool(is_read),
    }


def notification_reason_text(notification_type):
    if notification_type in {"topic_request_approved", "topic_request_rejected", "topic_request_more_info"}:
        return "You submitted a topic request that changed status."
    if notification_type in {"topic_comment_posted", "comment_reply_posted"}:
        return "Someone engaged with a discussion you participated in."
    if notification_type == "new_topic_in_followed_category":
        return "This matches a category or discussion pattern you follow."
    if notification_type in {"class_topic_posted", "class_reply_posted"}:
        return "This happened in one of your classes."
    if notification_type in {"reported_reply_notice", "reported_topic_notice"}:
        return "Content you own was reported for admin review."
    return "This is part of your UniConnect activity feed."


# =========================
# TOPICS
# =========================
def topics(request):
    current_user_id = request.GET.get("user_id")
    search_query = str(request.GET.get("q") or "").strip().lower()
    role_filter = str(request.GET.get("role") or "").strip().lower()
    status_filter = str(request.GET.get("status") or "").strip().lower()
    date_filter = str(request.GET.get("date_range") or "").strip().lower()
    topic_upvote_supported = has_topic_upvote_support()
    cover_image_column = topic_cover_column_name()

    cursor = connection.cursor()
    topic_upvote_sql = """
            (
                SELECT COUNT(*)
                FROM UPVOTE uv
                WHERE uv.TOPIC_ID = t.TOPIC_ID
            ) AS TOPIC_UPVOTES,
            CASE
                WHEN %s IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM UPVOTE uv2
                    WHERE uv2.TOPIC_ID = t.TOPIC_ID
                      AND uv2.USER_ID = %s
                ) THEN 1
                ELSE 0
            END AS HAS_UPVOTED
    """ if topic_upvote_supported else """
            0 AS TOPIC_UPVOTES,
            0 AS HAS_UPVOTED
    """
    cover_image_sql = f"t.{cover_image_column} AS COVER_IMAGE_PATH" if cover_image_column else "NULL AS COVER_IMAGE_PATH"

    cursor.execute(f"""
        SELECT 
            t.TOPIC_ID,
            t.TITLE,
            t.DESCRIPTION,
            t.STATUS,
            t.CREATED_AT,
            t.CREATED_BY,
            u.FIRST_NAME,
            u.LAST_NAME,
            u.ROLE,
            c.CATEGORY_NAME,
            {cover_image_sql},
            (
                SELECT COUNT(*)
                FROM POST p
                WHERE p.TOPIC_ID = t.TOPIC_ID
                  AND IFNULL(p.IS_DELETED, 0) = 0
            ) AS REPLY_COUNT,
            {topic_upvote_sql}
        FROM TOPIC t
        JOIN USER u ON t.CREATED_BY = u.USER_ID
        JOIN CATEGORY c ON t.CATEGORY_ID = c.CATEGORY_ID
        WHERE t.STATUS IN ('approved', 'inactive')
        ORDER BY t.CREATED_AT DESC
    """, [current_user_id, current_user_id] if topic_upvote_supported else [])

    columns = [col[0] for col in cursor.description]
    rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

    data = []
    for row in rows:
        row["COVER_IMAGE_PATH"] = build_media_url(row.get("COVER_IMAGE_PATH"))
        data.append(row)

    if search_query:
        data = [
            row for row in data
            if search_query in str(row.get("TITLE") or "").lower()
            or search_query in str(row.get("DESCRIPTION") or "").lower()
            or search_query in str(row.get("FIRST_NAME") or "").lower()
            or search_query in str(row.get("LAST_NAME") or "").lower()
        ]

    if role_filter in {"student", "faculty", "admin"}:
        data = [row for row in data if str(row.get("ROLE") or "").lower() == role_filter]

    if status_filter in {"active", "inactive"}:
        wanted_status = "approved" if status_filter == "active" else "inactive"
        data = [row for row in data if str(row.get("STATUS") or "").lower() == wanted_status]

    if date_filter in {"7d", "30d", "90d"}:
        from datetime import datetime, timedelta
        cutoff = datetime.now() - timedelta(days={"7d": 7, "30d": 30, "90d": 90}[date_filter])
        filtered_rows = []
        for row in data:
            created_at = row.get("CREATED_AT")
            if hasattr(created_at, "timestamp") and created_at >= cutoff:
                filtered_rows.append(row)
        data = filtered_rows

    return JsonResponse(data, safe=False)


# =========================
# POSTS / REPLIES
# =========================
def posts(request, topic_id):
    current_user_id = request.GET.get("user_id")
    post_updated_at_supported = has_column("POST", "UPDATED_AT")
    ensure_topic_request_support_tables()

    cursor = connection.cursor()
    cursor.execute("""
        SELECT STATUS
        FROM TOPIC
        WHERE TOPIC_ID = %s
    """, [topic_id])
    topic_row = cursor.fetchone()
    if not topic_row or str(topic_row[0]).lower() == "hidden":
        return JsonResponse([], safe=False)

    updated_at_sql = "P.UPDATED_AT" if post_updated_at_supported else "NULL AS UPDATED_AT"

    cursor.execute("""
        SELECT 
            P.POST_ID,
            P.CONTENT,
            P.CREATED_AT,
            """ + updated_at_sql + """,
            P.CREATED_BY,
            P.PARENT_POST_ID,
            IFNULL(P.IS_DELETED,0) AS IS_DELETED,
            U.FIRST_NAME,
            U.LAST_NAME,
            U.ROLE,
            IFNULL(COUNT(UV.UPVOTE_ID),0) AS UPVOTES,
            (
                SELECT COUNT(*)
                FROM CONTENT_REPORT cr
                WHERE cr.TARGET_TYPE = 'reply'
                  AND cr.TARGET_ID = P.POST_ID
                  AND cr.STATUS = 'pending'
            ) AS PENDING_REPORT_COUNT,
            (
                SELECT GROUP_CONCAT(cr.REASON ORDER BY cr.CREATED_AT DESC SEPARATOR ' | ')
                FROM CONTENT_REPORT cr
                WHERE cr.TARGET_TYPE = 'reply'
                  AND cr.TARGET_ID = P.POST_ID
                  AND cr.STATUS = 'pending'
            ) AS REPORT_REASON_SUMMARY,
            (
                SELECT GROUP_CONCAT(cr.DETAILS ORDER BY cr.CREATED_AT DESC SEPARATOR ' | ')
                FROM CONTENT_REPORT cr
                WHERE cr.TARGET_TYPE = 'reply'
                  AND cr.TARGET_ID = P.POST_ID
                  AND cr.STATUS = 'pending'
                  AND cr.DETAILS IS NOT NULL
                  AND cr.DETAILS <> ''
            ) AS REPORT_DETAILS_SUMMARY,
            CASE
                WHEN %s IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM UPVOTE UV2
                    WHERE UV2.POST_ID = P.POST_ID
                      AND UV2.USER_ID = %s
                ) THEN 1
                ELSE 0
            END AS HAS_UPVOTED
        FROM POST P
        JOIN USER U ON P.CREATED_BY = U.USER_ID
        LEFT JOIN UPVOTE UV ON UV.POST_ID = P.POST_ID
        WHERE P.TOPIC_ID = %s
        GROUP BY 
            P.POST_ID,
            P.CONTENT,
            P.CREATED_AT,
            """ + ("P.UPDATED_AT," if post_updated_at_supported else "") + """
            P.CREATED_BY,
            P.PARENT_POST_ID,
            P.IS_DELETED,
            U.FIRST_NAME,
            U.LAST_NAME,
            U.ROLE
        ORDER BY P.CREATED_AT ASC
    """, [current_user_id, current_user_id, topic_id])

    columns = [col[0] for col in cursor.description]
    data = [dict(zip(columns, row)) for row in cursor.fetchall()]

    return JsonResponse(data, safe=False)


def user_topics(request, user_id):
    try:
        topic_upvote_supported = has_topic_upvote_support()
        cover_image_column = topic_cover_column_name()
        ensure_topic_request_support_tables()

        cursor = connection.cursor()
        topic_upvote_sql = """
                (
                    SELECT COUNT(*)
                    FROM UPVOTE uv
                    WHERE uv.TOPIC_ID = t.TOPIC_ID
                ) AS TOPIC_UPVOTES
        """ if topic_upvote_supported else """
                0 AS TOPIC_UPVOTES
        """
        cover_image_sql = f"t.{cover_image_column} AS COVER_IMAGE_PATH" if cover_image_column else "NULL AS COVER_IMAGE_PATH"

        cursor.execute(f"""
            SELECT
                t.TOPIC_ID,
                t.TITLE,
                t.DESCRIPTION,
                t.CREATED_AT,
                t.STATUS,
                c.CATEGORY_NAME,
                {cover_image_sql},
                m.PROOF_TEXT,
                m.ADMIN_FEEDBACK,
                (
                    SELECT COUNT(*)
                    FROM POST p
                    WHERE p.TOPIC_ID = t.TOPIC_ID
                      AND IFNULL(p.IS_DELETED, 0) = 0
                ) AS REPLY_COUNT,
                {topic_upvote_sql}
            FROM TOPIC t
            JOIN CATEGORY c ON t.CATEGORY_ID = c.CATEGORY_ID
            LEFT JOIN TOPIC_REQUEST_META m ON m.TOPIC_ID = t.TOPIC_ID
            WHERE t.CREATED_BY = %s
            ORDER BY t.CREATED_AT DESC
        """, [user_id])

        columns = [col[0] for col in cursor.description]
        data = [dict(zip(columns, row)) for row in cursor.fetchall()]
        for row in data:
            row["COVER_IMAGE_PATH"] = build_media_url(row.get("COVER_IMAGE_PATH"))

        return JsonResponse(data, safe=False)
    except Exception as e:
        print("USER TOPICS ERROR:", e)
        return JsonResponse([], safe=False)


def user_replies(request, user_id):

    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            p.POST_ID,
            p.TOPIC_ID,
            p.CONTENT,
            p.CREATED_AT,
            IFNULL(COUNT(uv.UPVOTE_ID), 0) AS UPVOTES,
            (
                SELECT COUNT(*)
                FROM POST child
                WHERE child.PARENT_POST_ID = p.POST_ID
                  AND IFNULL(child.IS_DELETED, 0) = 0
            ) AS REPLY_COUNT,
            t.TITLE AS TOPIC_TITLE
        FROM POST p
        JOIN TOPIC t ON p.TOPIC_ID = t.TOPIC_ID
        LEFT JOIN UPVOTE uv ON uv.POST_ID = p.POST_ID
        WHERE p.CREATED_BY = %s
          AND IFNULL(p.IS_DELETED, 0) = 0
        GROUP BY
            p.POST_ID,
            p.TOPIC_ID,
            p.CONTENT,
            p.CREATED_AT,
            t.TITLE
        ORDER BY p.CREATED_AT DESC
    """, [user_id])

    columns = [col[0] for col in cursor.description]
    data = [dict(zip(columns, row)) for row in cursor.fetchall()]

    return JsonResponse(data, safe=False)


def user_engagement_summary(request, user_id):

    cursor = connection.cursor()

    if has_topic_upvote_support():
        cursor.execute("""
            SELECT COUNT(*)
            FROM UPVOTE
            WHERE USER_ID = %s
        """, [user_id])
    else:
        cursor.execute("""
            SELECT COUNT(*)
            FROM UPVOTE
            WHERE USER_ID = %s AND POST_ID IS NOT NULL
        """, [user_id])

    upvotes_given = cursor.fetchone()[0]

    return JsonResponse({
        "upvotesGiven": int(upvotes_given)
    })


# =========================
# CLASSES
# =========================
def classes(request):
    if not has_class_feature_support():
        return JsonResponse([], safe=False)

    current_user_id = request.GET.get("user_id")
    current_user_id = int(current_user_id) if current_user_id else None

    cursor = connection.cursor()
    cursor.execute("""
        SELECT
            c.CLASS_ID,
            c.CLASS_CODE,
            c.SUBJECT_NAME,
            c.DEPARTMENT,
            c.INSTRUCTOR_ID,
            u.FIRST_NAME,
            u.LAST_NAME,
            c.SEMESTER,
            c.DESCRIPTION,
            c.CREATED_AT,
            c.DAYS,
            c.TIMINGS,
            c.CLASS_AREA,
            (
                SELECT COUNT(*)
                FROM CLASS_ENROLLMENT ce
                WHERE ce.CLASS_ID = c.CLASS_ID
                  AND ce.STATUS = 'approved'
            ) AS ENROLLED_COUNT,
            (
                SELECT COUNT(*)
                FROM CLASS_DISCUSSION cd
                WHERE cd.CLASS_ID = c.CLASS_ID
            ) AS DISCUSSION_COUNT,
            CASE
                WHEN %s IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM CLASS_ENROLLMENT ce2
                    WHERE ce2.CLASS_ID = c.CLASS_ID
                      AND ce2.STUDENT_ID = %s
                      AND ce2.STATUS = 'approved'
                ) THEN 1
                ELSE 0
            END AS IS_ENROLLED,
            CASE
                WHEN %s IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM CLASS_ENROLLMENT ce3
                    WHERE ce3.CLASS_ID = c.CLASS_ID
                      AND ce3.STUDENT_ID = %s
                      AND ce3.STATUS = 'pending'
                ) THEN 1
                ELSE 0
            END AS HAS_PENDING_REQUEST
        FROM CLASSROOM c
        JOIN USER u ON c.INSTRUCTOR_ID = u.USER_ID
        ORDER BY c.CREATED_AT DESC
    """, [current_user_id, current_user_id, current_user_id, current_user_id])

    data = [build_class_payload(row) for row in cursor.fetchall()]
    return JsonResponse(data, safe=False)


def class_detail(request, class_id):
    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Class database tables are not set up yet."})

    current_user_id = request.GET.get("user_id")
    current_user_id = int(current_user_id) if current_user_id else None

    cursor = connection.cursor()
    cursor.execute("""
        SELECT
            c.CLASS_ID,
            c.CLASS_CODE,
            c.SUBJECT_NAME,
            c.DEPARTMENT,
            c.INSTRUCTOR_ID,
            u.FIRST_NAME,
            u.LAST_NAME,
            c.SEMESTER,
            c.DESCRIPTION,
            c.CREATED_AT,
            c.DAYS,
            c.TIMINGS,
            c.CLASS_AREA,
            (
                SELECT COUNT(*)
                FROM CLASS_ENROLLMENT ce
                WHERE ce.CLASS_ID = c.CLASS_ID
                  AND ce.STATUS = 'approved'
            ) AS ENROLLED_COUNT,
            (
                SELECT COUNT(*)
                FROM CLASS_DISCUSSION cd
                WHERE cd.CLASS_ID = c.CLASS_ID
            ) AS DISCUSSION_COUNT,
            CASE
                WHEN %s IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM CLASS_ENROLLMENT ce2
                    WHERE ce2.CLASS_ID = c.CLASS_ID
                      AND ce2.STUDENT_ID = %s
                      AND ce2.STATUS = 'approved'
                ) THEN 1
                ELSE 0
            END AS IS_ENROLLED,
            CASE
                WHEN %s IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM CLASS_ENROLLMENT ce3
                    WHERE ce3.CLASS_ID = c.CLASS_ID
                      AND ce3.STUDENT_ID = %s
                      AND ce3.STATUS = 'pending'
                ) THEN 1
                ELSE 0
            END AS HAS_PENDING_REQUEST
        FROM CLASSROOM c
        JOIN USER u ON c.INSTRUCTOR_ID = u.USER_ID
        WHERE c.CLASS_ID = %s
    """, [current_user_id, current_user_id, current_user_id, current_user_id, class_id])

    row = cursor.fetchone()
    if not row:
        return JsonResponse({"success": False, "message": "Class not found"})

    return JsonResponse({"success": True, "class": build_class_payload(row)})


@csrf_exempt
def create_class(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before creating classes."})

    try:
        data = json.loads(request.body)
        class_code = data.get("code", "").strip().upper()
        subject_name = data.get("name", "").strip()
        timings = data.get("time", "").strip()
        class_area = data.get("location", "").strip()
        delivery_mode = (data.get("delivery_mode") or "offline").strip().lower()
        days = data.get("days", [])
        instructor_id = data.get("user_id")
        department = (data.get("department") or "General").strip()
        semester = (data.get("semester") or "Spring 2026").strip()
        description = (data.get("description") or "").strip()

        if not class_code or not subject_name or not timings or not class_area or not instructor_id:
            return JsonResponse({"success": False, "message": "Missing required class fields"})

        if delivery_mode not in {"online", "offline", "hybrid"}:
            delivery_mode = "offline"

        days_value = ", ".join(day.strip() for day in days if str(day).strip()) if isinstance(days, list) else str(days).strip()
        if not days_value:
            days_value = "To Be Announced"

        description_value = f"[MODE:{delivery_mode}]\n{description}" if description else f"[MODE:{delivery_mode}]"

        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO CLASSROOM
            (CLASS_CODE, SUBJECT_NAME, TIMINGS, CLASS_AREA, DEPARTMENT, INSTRUCTOR_ID, SEMESTER, DESCRIPTION, DAYS)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [class_code, subject_name, timings, class_area, department, instructor_id, semester, description_value, days_value])

        return JsonResponse({"success": True, "classId": cursor.lastrowid})
    except Exception as e:
        print("CREATE CLASS ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not create class"})


def class_join_requests(request):
    if not has_class_feature_support():
        return JsonResponse([], safe=False)

    user_id = request.GET.get("user_id")
    role = (request.GET.get("role") or "").lower()

    cursor = connection.cursor()

    if role == "faculty":
        cursor.execute("""
            SELECT
                ce.ENROLLMENT_ID,
                ce.CLASS_ID,
                c.SUBJECT_NAME,
                c.CLASS_CODE,
                ce.STUDENT_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                ce.STATUS,
                ce.REQUESTED_AT,
                ce.REVIEWED_AT
            FROM CLASS_ENROLLMENT ce
            JOIN CLASSROOM c ON ce.CLASS_ID = c.CLASS_ID
            JOIN USER u ON ce.STUDENT_ID = u.USER_ID
            WHERE c.INSTRUCTOR_ID = %s
            ORDER BY ce.REQUESTED_AT DESC
        """, [user_id])
    else:
        cursor.execute("""
            SELECT
                ce.ENROLLMENT_ID,
                ce.CLASS_ID,
                c.SUBJECT_NAME,
                c.CLASS_CODE,
                ce.STUDENT_ID,
                u.FIRST_NAME,
                u.LAST_NAME,
                u.EMAIL,
                ce.STATUS,
                ce.REQUESTED_AT,
                ce.REVIEWED_AT
            FROM CLASS_ENROLLMENT ce
            JOIN CLASSROOM c ON ce.CLASS_ID = c.CLASS_ID
            JOIN USER u ON ce.STUDENT_ID = u.USER_ID
            WHERE ce.STUDENT_ID = %s
            ORDER BY ce.REQUESTED_AT DESC
        """, [user_id])

    data = []
    for row in cursor.fetchall():
        data.append({
            "id": str(row[0]),
            "classId": str(row[1]),
            "className": row[2],
            "classCode": row[3],
            "studentId": str(row[4]),
            "studentName": f"{row[5]} {row[6]}".strip(),
            "studentEmail": row[7],
            "status": row[8],
            "submittedAt": row[9],
            "reviewedAt": row[10],
        })

    return JsonResponse(data, safe=False)


@csrf_exempt
def submit_class_join_request(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before requesting classes."})

    try:
        data = json.loads(request.body)
        class_id = data.get("class_id")
        student_id = data.get("user_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT ENROLLMENT_ID, STATUS
            FROM CLASS_ENROLLMENT
            WHERE CLASS_ID = %s AND STUDENT_ID = %s
        """, [class_id, student_id])
        existing = cursor.fetchone()

        if existing and existing[1] in ("pending", "approved"):
            return JsonResponse({"success": False, "message": "You already have an active request for this class"})

        if existing:
            cursor.execute("""
                UPDATE CLASS_ENROLLMENT
                SET STATUS = 'pending', REQUESTED_AT = CURRENT_TIMESTAMP, REVIEWED_AT = NULL
                WHERE ENROLLMENT_ID = %s
            """, [existing[0]])
        else:
            cursor.execute("""
                INSERT INTO CLASS_ENROLLMENT (CLASS_ID, STUDENT_ID, STATUS)
                VALUES (%s, %s, 'pending')
            """, [class_id, student_id])

        return JsonResponse({"success": True})
    except Exception as e:
        print("CLASS JOIN REQUEST ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not submit class request"})


@csrf_exempt
def approve_class_join_request(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before approving class requests."})

    try:
        data = json.loads(request.body)
        enrollment_id = data.get("request_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT ce.STUDENT_ID, c.SUBJECT_NAME
            FROM CLASS_ENROLLMENT ce
            JOIN CLASSROOM c ON ce.CLASS_ID = c.CLASS_ID
            WHERE ce.ENROLLMENT_ID = %s
        """, [enrollment_id])
        row = cursor.fetchone()

        if not row:
            return JsonResponse({"success": False, "message": "Join request not found"})

        cursor.execute("""
            UPDATE CLASS_ENROLLMENT
            SET STATUS = 'approved', REVIEWED_AT = CURRENT_TIMESTAMP
            WHERE ENROLLMENT_ID = %s
        """, [enrollment_id])

        cursor.execute("""
            INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
            VALUES (%s, %s, 0)
        """, [row[0], f'general||Your request to join "{row[1]}" has been approved.'])

        return JsonResponse({"success": True})
    except Exception as e:
        print("APPROVE CLASS JOIN REQUEST ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not approve class request"})


@csrf_exempt
def reject_class_join_request(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before rejecting class requests."})

    try:
        data = json.loads(request.body)
        enrollment_id = data.get("request_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT ce.STUDENT_ID, c.SUBJECT_NAME
            FROM CLASS_ENROLLMENT ce
            JOIN CLASSROOM c ON ce.CLASS_ID = c.CLASS_ID
            WHERE ce.ENROLLMENT_ID = %s
        """, [enrollment_id])
        row = cursor.fetchone()

        if not row:
            return JsonResponse({"success": False, "message": "Join request not found"})

        cursor.execute("""
            UPDATE CLASS_ENROLLMENT
            SET STATUS = 'rejected', REVIEWED_AT = CURRENT_TIMESTAMP
            WHERE ENROLLMENT_ID = %s
        """, [enrollment_id])

        cursor.execute("""
            INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
            VALUES (%s, %s, 0)
        """, [row[0], f'general||Your request to join "{row[1]}" was rejected.'])

        return JsonResponse({"success": True})
    except Exception as e:
        print("REJECT CLASS JOIN REQUEST ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not reject class request"})


def class_students(request, class_id):
    if not has_class_feature_support():
        return JsonResponse([], safe=False)

    cursor = connection.cursor()
    cursor.execute("""
        SELECT
            u.USER_ID,
            u.FIRST_NAME,
            u.LAST_NAME,
            u.EMAIL,
            u.ROLE
        FROM CLASS_ENROLLMENT ce
        JOIN USER u ON ce.STUDENT_ID = u.USER_ID
        WHERE ce.CLASS_ID = %s
          AND ce.STATUS = 'approved'
        ORDER BY u.FIRST_NAME, u.LAST_NAME
    """, [class_id])

    data = []
    for row in cursor.fetchall():
        data.append({
            "id": str(row[0]),
            "name": f"{row[1]} {row[2]}".strip(),
            "email": row[3],
            "role": row[4],
        })

    return JsonResponse(data, safe=False)


def class_resources(request, class_id):
    if not has_class_feature_support():
        return JsonResponse([], safe=False)

    ensure_class_resource_support()
    cursor = connection.cursor()
    cursor.execute("""
        SELECT
            r.RESOURCE_ID,
            r.CLASS_ID,
            r.TITLE,
            r.DESCRIPTION,
            r.RESOURCE_TYPE,
            r.RESOURCE_URL,
            r.FILE_PATH,
            r.IS_PINNED,
            r.CREATED_BY,
            u.FIRST_NAME,
            u.LAST_NAME,
            r.CREATED_AT
        FROM CLASS_RESOURCE r
        JOIN USER u ON r.CREATED_BY = u.USER_ID
        WHERE r.CLASS_ID = %s
        ORDER BY r.IS_PINNED DESC, r.CREATED_AT DESC
    """, [class_id])

    data = [build_class_resource_payload(row) for row in cursor.fetchall()]
    return JsonResponse(data, safe=False)


def class_conversations(request, class_id):
    if not has_class_feature_support():
        return JsonResponse({"discussions": [], "replies": []})

    current_user_id = request.GET.get("user_id")

    cursor = connection.cursor()
    cursor.execute("""
        SELECT
            d.DISCUSSION_ID,
            d.CLASS_ID,
            d.TITLE,
            d.CONTENT,
            d.CREATED_BY,
            u.FIRST_NAME,
            u.LAST_NAME,
            u.ROLE,
            d.CREATED_AT,
            d.IS_PINNED,
            (
                SELECT COUNT(*)
                FROM CLASS_DISCUSSION_REPLY r
                WHERE r.DISCUSSION_ID = d.DISCUSSION_ID
                  AND IFNULL(r.IS_DELETED, 0) = 0
            ) AS REPLY_COUNT,
            (
                SELECT COUNT(*)
                FROM CLASS_DISCUSSION_VOTE v
                WHERE v.DISCUSSION_ID = d.DISCUSSION_ID
            ) AS UPVOTES,
            CASE
                WHEN %s IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM CLASS_DISCUSSION_VOTE v2
                    WHERE v2.DISCUSSION_ID = d.DISCUSSION_ID
                      AND v2.USER_ID = %s
                ) THEN 1
                ELSE 0
            END AS HAS_UPVOTED
        FROM CLASS_DISCUSSION d
        JOIN USER u ON d.CREATED_BY = u.USER_ID
        WHERE d.CLASS_ID = %s
        ORDER BY d.IS_PINNED DESC, d.CREATED_AT DESC
    """, [current_user_id, current_user_id, class_id])

    discussions = []
    for row in cursor.fetchall():
        discussions.append({
            "id": str(row[0]),
            "classId": str(row[1]),
            "title": row[2],
            "content": row[3],
            "authorId": str(row[4]),
            "authorName": f"{row[5]} {row[6]}".strip(),
            "authorRole": row[7],
            "createdAt": row[8],
            "isPinned": bool(row[9]),
            "replyCount": int(row[10] or 0),
            "upvotes": int(row[11] or 0),
            "upvotedBy": [str(current_user_id)] if current_user_id and int(row[12] or 0) == 1 else [],
        })

    cursor.execute("""
        SELECT
            r.REPLY_ID,
            r.DISCUSSION_ID,
            r.CLASS_ID,
            r.CONTENT,
            r.CREATED_BY,
            u.FIRST_NAME,
            u.LAST_NAME,
            u.ROLE,
            r.CREATED_AT,
            (
                SELECT COUNT(*)
                FROM CLASS_DISCUSSION_VOTE v
                WHERE v.REPLY_ID = r.REPLY_ID
            ) AS UPVOTES,
            CASE
                WHEN %s IS NOT NULL AND EXISTS (
                    SELECT 1
                    FROM CLASS_DISCUSSION_VOTE v2
                    WHERE v2.REPLY_ID = r.REPLY_ID
                      AND v2.USER_ID = %s
                ) THEN 1
                ELSE 0
            END AS HAS_UPVOTED
        FROM CLASS_DISCUSSION_REPLY r
        JOIN USER u ON r.CREATED_BY = u.USER_ID
        WHERE r.CLASS_ID = %s
          AND IFNULL(r.IS_DELETED, 0) = 0
        ORDER BY r.CREATED_AT ASC
    """, [current_user_id, current_user_id, class_id])

    replies = []
    for row in cursor.fetchall():
        replies.append({
            "id": str(row[0]),
            "discussionId": str(row[1]),
            "classId": str(row[2]),
            "content": row[3],
            "authorId": str(row[4]),
            "authorName": f"{row[5]} {row[6]}".strip(),
            "authorRole": row[7],
            "createdAt": row[8],
            "upvotes": int(row[9] or 0),
            "upvotedBy": [str(current_user_id)] if current_user_id and int(row[10] or 0) == 1 else [],
        })

    return JsonResponse({"discussions": discussions, "replies": replies})


@csrf_exempt
def upload_class_resource(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before uploading resources."})

    ensure_class_resource_support()

    try:
        class_id = request.POST.get("class_id")
        user_id = request.POST.get("user_id")
        title = (request.POST.get("title") or "").strip()
        description = (request.POST.get("description") or "").strip()
        resource_type = (request.POST.get("resource_type") or "material").strip().lower()
        resource_url = (request.POST.get("resource_url") or "").strip()
        is_pinned = str(request.POST.get("is_pinned") or "").strip().lower() in ("1", "true", "yes", "on")
        file_obj = request.FILES.get("file")

        if resource_type not in {"syllabus", "assignment", "material", "link"}:
            resource_type = "material"

        if not class_id or not user_id or not title:
            return JsonResponse({"success": False, "message": "Title, class, and user are required."})

        if not resource_url and not file_obj:
            return JsonResponse({"success": False, "message": "Attach a file or add a link."})

        cursor = connection.cursor()
        cursor.execute("""
            SELECT c.INSTRUCTOR_ID, c.SUBJECT_NAME, u.FIRST_NAME, u.LAST_NAME, u.ROLE
            FROM CLASSROOM c
            JOIN USER u ON u.USER_ID = %s
            WHERE c.CLASS_ID = %s
        """, [user_id, class_id])
        class_row = cursor.fetchone()

        if not class_row:
            return JsonResponse({"success": False, "message": "Class not found."})

        instructor_id, subject_name, first_name, last_name, role = class_row
        if int(instructor_id) != int(user_id) and role != "admin":
            return JsonResponse({"success": False, "message": "Only the instructor or an admin can upload class resources."})

        file_path = None
        if file_obj:
            file_path = save_uploaded_media(file_obj, "class_resources")

        cursor.execute("""
            INSERT INTO CLASS_RESOURCE (
                CLASS_ID,
                TITLE,
                DESCRIPTION,
                RESOURCE_TYPE,
                RESOURCE_URL,
                FILE_PATH,
                IS_PINNED,
                CREATED_BY
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, [
            class_id,
            title,
            description or None,
            resource_type,
            resource_url or None,
            file_path,
            1 if is_pinned else 0,
            user_id,
        ])

        resource_id = cursor.lastrowid
        creator_name = f"{first_name} {last_name}".strip()

        cursor.execute("""
            SELECT STUDENT_ID
            FROM CLASS_ENROLLMENT
            WHERE CLASS_ID = %s
              AND STATUS = 'approved'
        """, [class_id])
        recipient_ids = {str(row[0]) for row in cursor.fetchall()}
        recipient_ids.add(str(instructor_id))
        recipient_ids.discard(str(user_id))

        if recipient_ids:
            summary = f'New {resource_type} in "{subject_name}": "{title}"'
            cursor.executemany("""
                INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                VALUES (%s, %s, 0)
            """, [
                (recipient_id, f'class_topic_posted|{class_id}|{summary}')
                for recipient_id in recipient_ids
            ])

        return JsonResponse({
            "success": True,
            "resource": {
                "id": str(resource_id),
                "classId": str(class_id),
                "title": title,
                "description": description,
                "resourceType": resource_type,
                "resourceUrl": resource_url,
                "fileUrl": file_path,
                "isPinned": is_pinned,
                "createdBy": str(user_id),
                "createdByName": creator_name,
                "createdAt": timezone.now(),
            }
        })
    except Exception as e:
        print("UPLOAD CLASS RESOURCE ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not upload class resource."})


@csrf_exempt
def create_class_discussion(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before creating discussions."})

    try:
        data = json.loads(request.body)
        class_id = data.get("class_id")
        user_id = data.get("user_id")
        title = data.get("title", "").strip()
        content = data.get("content", "").strip()

        if not class_id or not user_id or not title or not content:
            return JsonResponse({"success": False, "message": "Missing required discussion fields"})

        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO CLASS_DISCUSSION (CLASS_ID, TITLE, CONTENT, CREATED_BY)
            VALUES (%s, %s, %s, %s)
        """, [class_id, title, content, user_id])

        cursor.execute("""
            SELECT INSTRUCTOR_ID, SUBJECT_NAME
            FROM CLASSROOM
            WHERE CLASS_ID = %s
        """, [class_id])
        class_row = cursor.fetchone()

        if class_row:
            instructor_id, subject_name = class_row

            cursor.execute("""
                SELECT STUDENT_ID
                FROM CLASS_ENROLLMENT
                WHERE CLASS_ID = %s
                  AND STATUS = 'approved'
            """, [class_id])

            recipient_ids = {str(row[0]) for row in cursor.fetchall()}
            recipient_ids.add(str(instructor_id))
            recipient_ids.discard(str(user_id))

            if recipient_ids:
                message = f'New class topic in "{subject_name}": "{title}"'
                cursor.executemany("""
                    INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                    VALUES (%s, %s, 0)
                """, [
                    (recipient_id, f'class_topic_posted|{class_id}|{message}')
                    for recipient_id in recipient_ids
                ])

        return JsonResponse({"success": True})
    except Exception as e:
        print("CREATE CLASS DISCUSSION ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not create discussion"})


@csrf_exempt
def create_class_discussion_reply(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before replying to class discussions."})

    try:
        data = json.loads(request.body)
        class_id = data.get("class_id")
        discussion_id = data.get("discussion_id")
        user_id = data.get("user_id")
        content = data.get("content", "").strip()

        if not class_id or not discussion_id or not user_id or not content:
            return JsonResponse({"success": False, "message": "Missing required reply fields"})

        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO CLASS_DISCUSSION_REPLY (DISCUSSION_ID, CLASS_ID, CONTENT, CREATED_BY)
            VALUES (%s, %s, %s, %s)
        """, [discussion_id, class_id, content, user_id])

        cursor.execute("""
            SELECT d.CREATED_BY, c.INSTRUCTOR_ID, c.SUBJECT_NAME, d.TITLE
            FROM CLASS_DISCUSSION d
            JOIN CLASSROOM c ON d.CLASS_ID = c.CLASS_ID
            WHERE d.DISCUSSION_ID = %s
        """, [discussion_id])
        discussion_row = cursor.fetchone()

        if discussion_row:
            discussion_author_id, instructor_id, subject_name, discussion_title = discussion_row
            recipient_ids = {
                str(discussion_author_id),
                str(instructor_id),
                str(user_id),
            }

            message = f'New reply in "{subject_name}" on "{discussion_title}"'
            cursor.executemany("""
                INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                VALUES (%s, %s, 0)
            """, [
                (recipient_id, f'class_reply_posted|{class_id}|{message}')
                for recipient_id in recipient_ids
            ])

        return JsonResponse({"success": True})
    except Exception as e:
        print("CREATE CLASS DISCUSSION REPLY ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not create reply"})


@csrf_exempt
def delete_class_discussion(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before deleting class topics."})

    try:
        data = json.loads(request.body)
        discussion_id = data.get("discussion_id")
        user_id = data.get("user_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT d.CREATED_BY, c.INSTRUCTOR_ID
            FROM CLASS_DISCUSSION d
            JOIN CLASSROOM c ON d.CLASS_ID = c.CLASS_ID
            WHERE d.DISCUSSION_ID = %s
        """, [discussion_id])
        row = cursor.fetchone()

        if not row:
            return JsonResponse({"success": False, "message": "Class topic not found"})

        author_id, instructor_id = row
        can_delete = str(user_id) in {str(author_id), str(instructor_id)}

        if not can_delete:
            return JsonResponse({"success": False, "message": "You are not allowed to delete this class topic"})

        cursor.execute("""
            DELETE v
            FROM CLASS_DISCUSSION_VOTE v
            LEFT JOIN CLASS_DISCUSSION_REPLY r ON v.REPLY_ID = r.REPLY_ID
            WHERE v.DISCUSSION_ID = %s
               OR r.DISCUSSION_ID = %s
        """, [discussion_id, discussion_id])

        cursor.execute("""
            DELETE FROM CLASS_DISCUSSION_REPLY
            WHERE DISCUSSION_ID = %s
        """, [discussion_id])

        cursor.execute("""
            DELETE FROM CLASS_DISCUSSION
            WHERE DISCUSSION_ID = %s
        """, [discussion_id])

        return JsonResponse({"success": True})
    except Exception as e:
        print("DELETE CLASS DISCUSSION ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not delete class topic"})


@csrf_exempt
def delete_class_discussion_reply(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before deleting class replies."})

    try:
        data = json.loads(request.body)
        reply_id = data.get("reply_id")
        user_id = data.get("user_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT r.CREATED_BY, c.INSTRUCTOR_ID
            FROM CLASS_DISCUSSION_REPLY r
            JOIN CLASSROOM c ON r.CLASS_ID = c.CLASS_ID
            WHERE r.REPLY_ID = %s
        """, [reply_id])
        row = cursor.fetchone()

        if not row:
            return JsonResponse({"success": False, "message": "Class reply not found"})

        author_id, instructor_id = row
        can_delete = str(user_id) in {str(author_id), str(instructor_id)}

        if not can_delete:
            return JsonResponse({"success": False, "message": "You are not allowed to delete this class reply"})

        cursor.execute("""
            DELETE FROM CLASS_DISCUSSION_VOTE
            WHERE REPLY_ID = %s
        """, [reply_id])

        cursor.execute("""
            DELETE FROM CLASS_DISCUSSION_REPLY
            WHERE REPLY_ID = %s
        """, [reply_id])

        return JsonResponse({"success": True})
    except Exception as e:
        print("DELETE CLASS DISCUSSION REPLY ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not delete class reply"})


@csrf_exempt
def upvote_class_discussion(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before upvoting class discussions."})

    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")
        discussion_id = data.get("discussion_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT VOTE_ID
            FROM CLASS_DISCUSSION_VOTE
            WHERE USER_ID = %s AND DISCUSSION_ID = %s
        """, [user_id, discussion_id])
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                DELETE FROM CLASS_DISCUSSION_VOTE
                WHERE VOTE_ID = %s
            """, [existing[0]])
            return JsonResponse({"success": True, "upvoted": False})

        cursor.execute("""
            INSERT INTO CLASS_DISCUSSION_VOTE (USER_ID, DISCUSSION_ID)
            VALUES (%s, %s)
        """, [user_id, discussion_id])
        return JsonResponse({"success": True, "upvoted": True})
    except Exception as e:
        print("UPVOTE CLASS DISCUSSION ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not update discussion upvote"})


@csrf_exempt
def upvote_class_discussion_reply(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before upvoting class replies."})

    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")
        reply_id = data.get("reply_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT VOTE_ID
            FROM CLASS_DISCUSSION_VOTE
            WHERE USER_ID = %s AND REPLY_ID = %s
        """, [user_id, reply_id])
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                DELETE FROM CLASS_DISCUSSION_VOTE
                WHERE VOTE_ID = %s
            """, [existing[0]])
            return JsonResponse({"success": True, "upvoted": False})

        cursor.execute("""
            INSERT INTO CLASS_DISCUSSION_VOTE (USER_ID, REPLY_ID)
            VALUES (%s, %s)
        """, [user_id, reply_id])
        return JsonResponse({"success": True, "upvoted": True})
    except Exception as e:
        print("UPVOTE CLASS DISCUSSION REPLY ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not update reply upvote"})


@csrf_exempt
def toggle_pin_class_discussion(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before pinning discussions."})

    try:
        data = json.loads(request.body)
        discussion_id = data.get("discussion_id")
        user_id = data.get("user_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT d.IS_PINNED
            FROM CLASS_DISCUSSION d
            JOIN CLASSROOM c ON d.CLASS_ID = c.CLASS_ID
            WHERE d.DISCUSSION_ID = %s
              AND c.INSTRUCTOR_ID = %s
        """, [discussion_id, user_id])
        row = cursor.fetchone()

        if not row:
            return JsonResponse({"success": False, "message": "Only the class instructor can pin discussions"})

        cursor.execute("""
            UPDATE CLASS_DISCUSSION
            SET IS_PINNED = %s
            WHERE DISCUSSION_ID = %s
        """, [0 if int(row[0] or 0) == 1 else 1, discussion_id])

        return JsonResponse({"success": True})
    except Exception as e:
        print("TOGGLE PIN CLASS DISCUSSION ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not pin discussion"})


@csrf_exempt
def leave_class(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before leaving classes."})

    try:
        data = json.loads(request.body)
        class_id = data.get("class_id")
        user_id = data.get("user_id")

        cursor = connection.cursor()
        cursor.execute("""
            DELETE FROM CLASS_ENROLLMENT
            WHERE CLASS_ID = %s
              AND STUDENT_ID = %s
              AND STATUS = 'approved'
        """, [class_id, user_id])

        return JsonResponse({"success": True})
    except Exception as e:
        print("LEAVE CLASS ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not leave class"})


@csrf_exempt
def remove_student_from_class(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    if not has_class_feature_support():
        return JsonResponse({"success": False, "message": "Run the class SQL patch before removing students."})

    try:
        data = json.loads(request.body)
        class_id = data.get("class_id")
        student_id = data.get("student_id")
        instructor_id = data.get("user_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT CLASS_ID
            FROM CLASSROOM
            WHERE CLASS_ID = %s
              AND INSTRUCTOR_ID = %s
        """, [class_id, instructor_id])

        if not cursor.fetchone():
            return JsonResponse({"success": False, "message": "Only the instructor can remove students"})

        cursor.execute("""
            DELETE FROM CLASS_ENROLLMENT
            WHERE CLASS_ID = %s
              AND STUDENT_ID = %s
              AND STATUS = 'approved'
        """, [class_id, student_id])

        return JsonResponse({"success": True})
    except Exception as e:
        print("REMOVE STUDENT FROM CLASS ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not remove student"})

# =========================
# LOGIN
# =========================
@csrf_exempt
def login(request):

    if request.method == "POST":
        try:
            ensure_user_profile_support()
            data = json.loads(request.body)

            email = data.get("email")
            password = data.get("password")
            cursor = connection.cursor()

            def fetch_user_by_email_or_role(target_email, fallback_role):
                cursor.execute("""
                    SELECT USER_ID, FIRST_NAME, LAST_NAME, EMAIL, ROLE, STATUS, IS_ACTIVE,
                           CONTACT_INFO, BIO, DEPARTMENT, OFFICE_ADDRESS, OFFICE_HOURS,
                           INTERESTS_JSON, ACADEMIC_INTERESTS_JSON, NOTIFICATION_PREFERENCES_JSON,
                           VERIFIED_ROLE, VERIFIED_DEPARTMENT
                    FROM USER
                    WHERE LOWER(EMAIL) = LOWER(%s)
                    LIMIT 1
                """, [target_email])
                row = cursor.fetchone()
                if row:
                    return row

                cursor.execute("""
                    SELECT USER_ID, FIRST_NAME, LAST_NAME, EMAIL, ROLE, STATUS, IS_ACTIVE,
                           CONTACT_INFO, BIO, DEPARTMENT, OFFICE_ADDRESS, OFFICE_HOURS,
                           INTERESTS_JSON, ACADEMIC_INTERESTS_JSON, NOTIFICATION_PREFERENCES_JSON,
                           VERIFIED_ROLE, VERIFIED_DEPARTMENT
                    FROM USER
                    WHERE ROLE=%s AND STATUS='approved' AND IS_ACTIVE=1
                    ORDER BY USER_ID ASC
                    LIMIT 1
                """, [fallback_role])
                return cursor.fetchone()

            # ================= ADMIN =================
            if email == "himani@uni.edu" and password == "himani":
                row = fetch_user_by_email_or_role(email, "admin")
                if not row:
                    return JsonResponse({
                        "success": False,
                        "message": "Admin account is not set up in the database"
                    })
                return JsonResponse({
                    "success": True,
                    "user": build_user_payload_from_row(row)
                })

            if email == "shabarish@uni.edu" and password == "shabarish":
                row = fetch_user_by_email_or_role(email, "admin")
                if not row:
                    return JsonResponse({
                        "success": False,
                        "message": "Admin account is not set up in the database"
                    })
                return JsonResponse({
                    "success": True,
                    "user": build_user_payload_from_row(row)
                })

            # ================= FACULTY (HARDCODE) =================
            if email == "faculty1@uni.edu" and password == "f1":
                row = fetch_user_by_email_or_role(email, "faculty")
                if not row:
                    return JsonResponse({
                        "success": False,
                        "message": "Faculty account is not set up in the database"
                    })
                return JsonResponse({
                    "success": True,
                    "user": build_user_payload_from_row(row)
                })

            if email == "faculty2@uni.edu" and password == "f2":
                row = fetch_user_by_email_or_role(email, "faculty")
                if not row:
                    return JsonResponse({
                        "success": False,
                        "message": "Faculty account is not set up in the database"
                    })
                return JsonResponse({
                    "success": True,
                    "user": build_user_payload_from_row(row)
                })

            # ================= DATABASE USERS =================
            cursor.execute("""
                SELECT USER_ID, FIRST_NAME, LAST_NAME, EMAIL, ROLE, STATUS, IS_ACTIVE,
                       CONTACT_INFO, BIO, DEPARTMENT, OFFICE_ADDRESS, OFFICE_HOURS,
                       INTERESTS_JSON, ACADEMIC_INTERESTS_JSON, NOTIFICATION_PREFERENCES_JSON,
                       VERIFIED_ROLE, VERIFIED_DEPARTMENT
                FROM USER
                WHERE EMAIL=%s AND PASSWORD_HASH=%s
            """, [email, password])

            row = cursor.fetchone()

            if row:

                # ❌ BLOCK pending faculty
                if row[5] == "pending":
                    return JsonResponse({
                        "success": False,
                        "message": "Your faculty request is pending approval by admin"
                    })

                # ❌ BLOCK disabled users
                if row[6] == 0:
                    return JsonResponse({
                        "success": False,
                        "message": "Your account has been disabled. Contact admin at himani@uni.edu"
                    })

                # ✅ SUCCESS LOGIN
                return JsonResponse({
                    "success": True,
                    "user": build_user_payload_from_row(row)
                })

            return JsonResponse({
                "success": False,
                "message": "Invalid email or password"
            })

        except Exception as e:
            print("LOGIN ERROR:", e)
            return JsonResponse({
                "success": False,
                "message": "Server error"
            })

    return JsonResponse({"message": "POST only"})
# =========================
# SIGNUP
# =========================
@csrf_exempt
def signup(request):

    if request.method == "POST":
        try:
            ensure_user_profile_support()
            data = json.loads(request.body)

            firstName = data.get("firstName")
            lastName = data.get("lastName")
            email = data.get("email")
            password = data.get("password")
            role = data.get("role")   # 👈 NEW
            department = (data.get("department") or "").strip()
            interests = data.get("interests") if isinstance(data.get("interests"), list) else []

            cursor = connection.cursor()

            # check exists
            cursor.execute(
                "SELECT USER_ID FROM USER WHERE EMAIL=%s",
                [email]
            )

            if cursor.fetchone():
                return JsonResponse({
                    "success": False,
                    "message": "User already exists"
                })

            # 👇 FACULTY REQUEST FLOW
            if role == "faculty":

                cursor.execute("""
                    INSERT INTO USER
                    (FIRST_NAME, LAST_NAME, EMAIL, PASSWORD_HASH, ROLE, STATUS, IS_ACTIVE, DEPARTMENT, INTERESTS_JSON)
                    VALUES (%s,%s,%s,%s,'faculty','pending',0,%s,%s)
                """, [firstName, lastName, email, password, department or None, json.dumps(interests)])

                return JsonResponse({
                    "success": True,
                    "faculty_request": True
                })

            # 👇 NORMAL STUDENT
            cursor.execute("""
                INSERT INTO USER
                (FIRST_NAME, LAST_NAME, EMAIL, PASSWORD_HASH, ROLE, STATUS, IS_ACTIVE, DEPARTMENT, INTERESTS_JSON)
                VALUES (%s,%s,%s,%s,'student','approved',1,%s,%s)
            """, [firstName, lastName, email, password, department or None, json.dumps(interests)])

            user_id = cursor.lastrowid

            cursor.execute("""
                SELECT USER_ID, FIRST_NAME, LAST_NAME, EMAIL, ROLE, STATUS, IS_ACTIVE,
                       CONTACT_INFO, BIO, DEPARTMENT, OFFICE_ADDRESS, OFFICE_HOURS,
                       INTERESTS_JSON, ACADEMIC_INTERESTS_JSON, NOTIFICATION_PREFERENCES_JSON,
                       VERIFIED_ROLE, VERIFIED_DEPARTMENT
                FROM USER
                WHERE USER_ID = %s
            """, [user_id])
            user_row = cursor.fetchone()

            return JsonResponse({
                "success": True,
                "user": build_user_payload_from_row(user_row) if user_row else None
            })

        except Exception as e:
            print("SIGNUP ERROR:", e)
            return JsonResponse({"success": False})


# =========================
# ADD REPLY
# =========================
@csrf_exempt
def add_reply(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        data = json.loads(request.body)

        topic_id = data.get("topic_id")
        user_id = data.get("user_id")
        content = (data.get("content") or "").strip()
        parent_id = data.get("parent_id")

        if not topic_id or not user_id or not content:
            return JsonResponse({"success": False, "message": "Missing required reply fields"})

        cursor = connection.cursor()

        cursor.execute("""
            SELECT TITLE, CREATED_BY, STATUS
            FROM TOPIC
            WHERE TOPIC_ID = %s
        """, [topic_id])
        topic_row = cursor.fetchone()

        if not topic_row:
            return JsonResponse({"success": False, "message": "Topic not found"})

        topic_title, topic_owner_id, topic_status = topic_row

        if str(topic_status) != "approved":
            return JsonResponse({"success": False, "message": "This topic is inactive right now"})

        cursor.execute("""
            INSERT INTO POST
            (CONTENT,CREATED_BY,TOPIC_ID,PARENT_POST_ID)
            VALUES (%s,%s,%s,%s)
        """, [content, user_id, topic_id, parent_id])

        try:
            if str(topic_owner_id) != str(user_id):
                cursor.execute("""
                    INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                    VALUES (%s, %s, 0)
                """, [
                    topic_owner_id,
                    f'topic_comment_posted|{topic_id}|New comment on your topic "{topic_title}"'
                ])

            if parent_id:
                cursor.execute("""
                    SELECT CREATED_BY
                    FROM POST
                    WHERE POST_ID = %s
                """, [parent_id])
                parent_row = cursor.fetchone()

                if parent_row:
                    parent_author_id = parent_row[0]
                    if str(parent_author_id) != str(user_id):
                        cursor.execute("""
                            INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                            VALUES (%s, %s, 0)
                        """, [
                            parent_author_id,
                            f'comment_reply_posted|{topic_id}|New reply to your comment on "{topic_title}"'
                        ])
        except Exception as notification_error:
            print("REPLY NOTIFICATION ERROR:", notification_error)

        return JsonResponse({"success": True})
    except Exception as e:
        print("ADD REPLY ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not post reply"})


# =========================
# DELETE REPLY
# =========================
@csrf_exempt
def delete_reply(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            post_id = data.get("post_id")
            requester_id = data.get("user_id")
            requester_role = data.get("requester_role")

            cursor = connection.cursor()

            cursor.execute("""
                SELECT p.CREATED_BY, t.CREATED_BY
                FROM POST p
                JOIN TOPIC t ON p.TOPIC_ID = t.TOPIC_ID
                WHERE p.POST_ID = %s
            """, [post_id])

            row = cursor.fetchone()

            if not row:
                return JsonResponse({"success": False, "message": "Reply not found"})

            reply_author_id, topic_owner_id = row

            can_delete = (
                str(requester_role) == "admin" or
                str(requester_id) == str(reply_author_id) or
                str(requester_id) == str(topic_owner_id)
            )

            if not can_delete:
                return JsonResponse({
                    "success": False,
                    "message": "You are not allowed to delete this reply"
                })

            cursor.execute("""
                UPDATE POST
                SET IS_DELETED = 1
                WHERE POST_ID = %s
            """, [post_id])

            return JsonResponse({"success": True})

        except Exception as e:
            print("DELETE ERROR:", e)
            return JsonResponse({"success": False})

# =========================
# UPDATE REPLY
# =========================
@csrf_exempt
def update_reply(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            post_id = data.get("post_id")
            content = data.get("content")

            cursor = connection.cursor()
            post_updated_at_supported = has_column("POST", "UPDATED_AT")

            # prevent editing deleted
            cursor.execute("""
                SELECT IS_DELETED FROM POST
                WHERE POST_ID=%s
            """,[post_id])

            row = cursor.fetchone()

            if row and row[0] == 1:
                return JsonResponse({"success": False})

            if post_updated_at_supported:
                cursor.execute("""
                    UPDATE POST
                    SET CONTENT=%s, UPDATED_AT=NOW()
                    WHERE POST_ID=%s
                """, [content, post_id])
            else:
                cursor.execute("""
                    UPDATE POST
                    SET CONTENT=%s
                    WHERE POST_ID=%s
                """, [content, post_id])

            return JsonResponse({"success": True})

        except Exception as e:
            print("UPDATE ERROR:", e)
            return JsonResponse({"success": False})


# =========================
# UPVOTE
# =========================
@csrf_exempt
def upvote_topic(request):

    if request.method == "POST":
        try:
            if not has_topic_upvote_support():
                return JsonResponse({
                    "success": False,
                    "message": "Database update needed for topic upvotes"
                })

            data = json.loads(request.body)

            user_id = data.get("user_id")
            topic_id = data.get("topic_id")

            cursor = connection.cursor()

            cursor.execute("""
                SELECT UPVOTE_ID
                FROM UPVOTE
                WHERE USER_ID=%s AND TOPIC_ID=%s
            """, [user_id, topic_id])

            existing_vote = cursor.fetchone()

            if existing_vote:
                cursor.execute("""
                    DELETE FROM UPVOTE
                    WHERE USER_ID=%s AND TOPIC_ID=%s
                """, [user_id, topic_id])

                return JsonResponse({"success": True, "upvoted": False})

            cursor.execute("""
                INSERT INTO UPVOTE (USER_ID, TOPIC_ID)
                VALUES (%s, %s)
            """, [user_id, topic_id])

            return JsonResponse({"success": True, "upvoted": True})

        except Exception as e:
            print("TOPIC UPVOTE ERROR:", e)
            return JsonResponse({
                "success": False,
                "message": "Could not update topic upvote"
            })

    return JsonResponse({"success": False, "message": "POST only"})


@csrf_exempt
def upvote_reply(request):

    data = json.loads(request.body)

    user_id = data.get("user_id")
    post_id = data.get("post_id")

    cursor = connection.cursor()

    cursor.execute("""
        SELECT * FROM UPVOTE
        WHERE USER_ID=%s AND POST_ID=%s
    """,[user_id,post_id])

    if cursor.fetchone():
        cursor.execute("""
            DELETE FROM UPVOTE
            WHERE USER_ID=%s AND POST_ID=%s
        """, [user_id, post_id])
        return JsonResponse({"success": True, "upvoted": False})

    cursor.execute("""
        INSERT INTO UPVOTE (USER_ID,POST_ID)
    VALUES (%s,%s)
    """,[user_id,post_id])

    return JsonResponse({"success": True, "upvoted": True})


# =========================
# USERS
# =========================
def users(request):
    ensure_user_profile_support()

    cursor = connection.cursor()

    cursor.execute("""
    SELECT USER_ID, FIRST_NAME, LAST_NAME, EMAIL, ROLE, STATUS, IS_ACTIVE,
           CONTACT_INFO, BIO, DEPARTMENT, OFFICE_ADDRESS, OFFICE_HOURS,
           INTERESTS_JSON, ACADEMIC_INTERESTS_JSON, NOTIFICATION_PREFERENCES_JSON,
           VERIFIED_ROLE, VERIFIED_DEPARTMENT
    FROM USER
    WHERE STATUS='approved'   -- 🔥 ONLY APPROVED USERS
    ORDER BY USER_ID DESC
""")
    data = [build_user_payload_from_row(row) for row in cursor.fetchall()]
    return JsonResponse(data, safe=False)


@csrf_exempt
def update_user_profile(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        ensure_user_profile_support()
        data = json.loads(request.body)
        user_id = data.get("user_id")

        if not user_id:
            return JsonResponse({"success": False, "message": "User is required"})

        first_name = (data.get("firstName") or "").strip()
        last_name = (data.get("lastName") or "").strip()
        contact_info = (data.get("phoneNumber") or "").strip()
        bio = (data.get("bio") or "").strip()
        department = (data.get("department") or "").strip()
        office_address = (data.get("officeAddress") or "").strip()
        office_hours = (data.get("officeHours") or "").strip()
        interests = data.get("interests") if isinstance(data.get("interests"), list) else []
        academic_interests = data.get("academicInterests") if isinstance(data.get("academicInterests"), list) else []
        notification_preferences = normalized_notification_preferences(json.dumps(data.get("notificationPreferences") or {}))
        verified_role = 1 if data.get("verifiedRole", True) else 0
        verified_department = 1 if data.get("verifiedDepartment", bool(department)) else 0

        cursor = connection.cursor()
        cursor.execute("""
            UPDATE USER
            SET FIRST_NAME = %s,
                LAST_NAME = %s,
                CONTACT_INFO = %s,
                BIO = %s,
                DEPARTMENT = %s,
                OFFICE_ADDRESS = %s,
                OFFICE_HOURS = %s,
                INTERESTS_JSON = %s,
                ACADEMIC_INTERESTS_JSON = %s,
                NOTIFICATION_PREFERENCES_JSON = %s,
                VERIFIED_ROLE = %s,
                VERIFIED_DEPARTMENT = %s
            WHERE USER_ID = %s
        """, [
            first_name or None,
            last_name or None,
            contact_info or None,
            bio or None,
            department or None,
            office_address or None,
            office_hours or None,
            json.dumps(interests),
            json.dumps(academic_interests),
            json.dumps(notification_preferences),
            verified_role,
            verified_department,
            user_id,
        ])

        cursor.execute("""
            SELECT USER_ID, FIRST_NAME, LAST_NAME, EMAIL, ROLE, STATUS, IS_ACTIVE,
                   CONTACT_INFO, BIO, DEPARTMENT, OFFICE_ADDRESS, OFFICE_HOURS,
                   INTERESTS_JSON, ACADEMIC_INTERESTS_JSON, NOTIFICATION_PREFERENCES_JSON,
                   VERIFIED_ROLE, VERIFIED_DEPARTMENT
            FROM USER
            WHERE USER_ID = %s
        """, [user_id])
        row = cursor.fetchone()

        return JsonResponse({
            "success": True,
            "user": build_user_payload_from_row(row) if row else None,
        })
    except Exception as e:
        print("UPDATE USER PROFILE ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not update user profile"})


def message_conversations(request, user_id):
    cursor = connection.cursor()
    unread_sql = """
            SUM(
                CASE
                    WHEN m.RECEIVER_ID = %s AND IFNULL(m.IS_READ, 0) = 0 THEN 1
                    ELSE 0
                END
            ) AS UNREAD_COUNT
    """ if has_column("MESSAGE", "IS_READ") else """
            0 AS UNREAD_COUNT
    """

    cursor.execute(f"""
        SELECT
            CASE
                WHEN m.SENDER_ID = %s THEN m.RECEIVER_ID
                ELSE m.SENDER_ID
            END AS OTHER_USER_ID,
            u.FIRST_NAME,
            u.LAST_NAME,
            u.ROLE,
            MAX(m.SENT_AT) AS LAST_MESSAGE_TIME,
            SUBSTRING_INDEX(
                GROUP_CONCAT(m.MESSAGE_TEXT ORDER BY m.SENT_AT DESC SEPARATOR '||'),
                '||',
                1
            ) AS LAST_MESSAGE,
            {unread_sql}
        FROM MESSAGE m
        JOIN USER u
          ON u.USER_ID = CASE
              WHEN m.SENDER_ID = %s THEN m.RECEIVER_ID
              ELSE m.SENDER_ID
          END
        WHERE m.SENDER_ID = %s OR m.RECEIVER_ID = %s
        GROUP BY OTHER_USER_ID, u.FIRST_NAME, u.LAST_NAME, u.ROLE
        ORDER BY LAST_MESSAGE_TIME DESC
    """, [user_id, user_id, user_id, user_id, user_id] if has_column("MESSAGE", "IS_READ") else [user_id, user_id, user_id, user_id])

    data = []
    for row in cursor.fetchall():
        data.append({
            "userId": str(row[0]),
            "userName": f"{row[1]} {row[2]}".strip(),
            "userRole": row[3],
            "lastMessageTime": row[4],
            "lastMessage": row[5] or "",
            "unreadCount": int(row[6] or 0),
        })

    return JsonResponse(data, safe=False)


def message_thread(request, user_id, other_user_id):
    cursor = connection.cursor()
    read_sql = "IFNULL(IS_READ, 0) AS IS_READ" if has_column("MESSAGE", "IS_READ") else "0 AS IS_READ"
    cursor.execute(f"""
        SELECT
            MESSAGE_ID,
            SENDER_ID,
            RECEIVER_ID,
            MESSAGE_TEXT,
            SENT_AT,
            {read_sql}
        FROM MESSAGE
        WHERE (SENDER_ID = %s AND RECEIVER_ID = %s)
           OR (SENDER_ID = %s AND RECEIVER_ID = %s)
        ORDER BY SENT_AT ASC
    """, [user_id, other_user_id, other_user_id, user_id])

    data = []
    for row in cursor.fetchall():
        data.append({
            "id": str(row[0]),
            "senderId": str(row[1]),
            "receiverId": str(row[2]),
            "content": row[3],
            "createdAt": row[4],
            "read": bool(row[5]),
        })

    return JsonResponse(data, safe=False)


@csrf_exempt
def send_message_db(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        data = json.loads(request.body)
        sender_id = data.get("sender_id")
        receiver_id = data.get("receiver_id")
        message_text = (data.get("content") or "").strip()

        if not sender_id or not receiver_id or not message_text:
            return JsonResponse({"success": False, "message": "Missing message fields"})

        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO MESSAGE (SENDER_ID, RECEIVER_ID, MESSAGE_TEXT)
            VALUES (%s, %s, %s)
        """, [sender_id, receiver_id, message_text])

        return JsonResponse({"success": True, "messageId": str(cursor.lastrowid)})
    except Exception as e:
        print("SEND MESSAGE ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not send message"})


@csrf_exempt
def mark_messages_read(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")
        other_user_id = data.get("other_user_id")

        cursor = connection.cursor()
        if not has_column("MESSAGE", "IS_READ"):
            return JsonResponse({"success": True})

        cursor.execute("""
            UPDATE MESSAGE
            SET IS_READ = 1
            WHERE RECEIVER_ID = %s
              AND SENDER_ID = %s
        """, [user_id, other_user_id])

        return JsonResponse({"success": True})
    except Exception as e:
        print("MARK MESSAGES READ ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not mark messages read"})

@csrf_exempt
def create_topic(request):

    if request.method == "POST":
        cover_image_column = topic_cover_column_name()

        if request.content_type and "multipart/form-data" in request.content_type:
            data = request.POST
            title = data.get("title")
            content = data.get("content")
            category = normalize_category_name(data.get("category"))
            user_id = data.get("user_id")
            cover_image_path = save_uploaded_cover_image(request.FILES.get("coverImage")) if cover_image_column else None
        else:
            data = json.loads(request.body)
            title = data.get("title")
            content = data.get("content")
            category = normalize_category_name(data.get("category"))
            user_id = data.get("user_id")
            cover_image_path = data.get("coverImage")

        validation_error = validate_topic_payload(title, content, category, user_id)
        if validation_error:
            return JsonResponse({"success": False, "message": validation_error})

        cursor = connection.cursor()

        if cover_image_column:
            cursor.execute(f"""
                INSERT INTO TOPIC
                (TITLE, DESCRIPTION, CATEGORY_ID, CREATED_BY, STATUS, {cover_image_column})
                VALUES (
                    %s,
                    %s,
                    (SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_NAME=%s),
                    %s,
                    'approved',
                    %s
                )
            """, [title, content, category, user_id, cover_image_path])
        else:
            cursor.execute("""
                INSERT INTO TOPIC
                (TITLE, DESCRIPTION, CATEGORY_ID, CREATED_BY, STATUS)
                VALUES (
                    %s,
                    %s,
                    (SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_NAME=%s),
                    %s,
                    'approved'
                )
            """, [title, content, category, user_id])

        return JsonResponse({"success": True})

    return JsonResponse({"success": False})


@csrf_exempt
def submit_topic_request(request):

    if request.method == "POST":
        try:
            cover_image_column = topic_cover_column_name()

            if request.content_type and "multipart/form-data" in request.content_type:
                data = request.POST
                title = data.get("title")
                content = data.get("content")
                category = normalize_category_name(data.get("category"))
                user_id = data.get("user_id")
                topic_id = data.get("topic_id")
                proof_text = data.get("proof")
                cover_image_path = save_uploaded_cover_image(request.FILES.get("coverImage")) if cover_image_column else None
            else:
                data = json.loads(request.body)
                title = data.get("title")
                content = data.get("content")
                category = normalize_category_name(data.get("category"))
                user_id = data.get("user_id")
                topic_id = data.get("topic_id")
                proof_text = data.get("proof")
                cover_image_path = data.get("coverImage")

            validation_error = validate_topic_payload(title, content, category, user_id)
            if validation_error:
                return JsonResponse({"success": False, "message": validation_error})

            cursor = connection.cursor()

            if topic_id:
                cursor.execute("""
                    SELECT TOPIC_ID
                    FROM TOPIC
                    WHERE TOPIC_ID = %s
                      AND CREATED_BY = %s
                      AND STATUS = 'needs_more_info'
                """, [topic_id, user_id])

                if not cursor.fetchone():
                    return JsonResponse({"success": False, "message": "Topic request could not be updated"})

                if cover_image_column and cover_image_path:
                    cursor.execute(f"""
                        UPDATE TOPIC
                        SET TITLE = %s,
                            DESCRIPTION = %s,
                            CATEGORY_ID = (SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_NAME=%s),
                            STATUS = 'pending',
                            {cover_image_column} = %s
                        WHERE TOPIC_ID = %s
                    """, [title, content, category, cover_image_path, topic_id])
                else:
                    cursor.execute("""
                        UPDATE TOPIC
                        SET TITLE = %s,
                            DESCRIPTION = %s,
                            CATEGORY_ID = (SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_NAME=%s),
                            STATUS = 'pending'
                        WHERE TOPIC_ID = %s
                    """, [title, content, category, topic_id])

                upsert_topic_request_meta(topic_id, proof_text=proof_text, admin_feedback=None)
                add_topic_request_timeline(topic_id, "resubmitted", "Student resubmitted the topic request with updated proof or details.")
                return JsonResponse({"success": True, "updated": True})

            if cover_image_column:
                cursor.execute(f"""
                    INSERT INTO TOPIC
                    (TITLE, DESCRIPTION, CATEGORY_ID, CREATED_BY, STATUS, {cover_image_column})
                    VALUES (
                        %s,
                        %s,
                        (SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_NAME=%s),
                        %s,
                        'pending',
                        %s
                    )
                """, [title, content, category, user_id, cover_image_path])
                created_topic_id = cursor.lastrowid
            else:
                cursor.execute("""
                    INSERT INTO TOPIC
                    (TITLE, DESCRIPTION, CATEGORY_ID, CREATED_BY, STATUS)
                    VALUES (
                        %s,
                        %s,
                        (SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_NAME=%s),
                        %s,
                        'pending'
                    )
                """, [title, content, category, user_id])
                created_topic_id = cursor.lastrowid

            upsert_topic_request_meta(created_topic_id, proof_text=proof_text, admin_feedback=None)
            add_topic_request_timeline(created_topic_id, "submitted", "Student submitted the topic request for review.")

            return JsonResponse({"success": True})

        except Exception as e:
            print("SUBMIT TOPIC REQUEST ERROR:", e)
            return JsonResponse({
                "success": False,
                "message": "Could not submit topic request"
            })

    return JsonResponse({"success": False, "message": "POST only"})


def pending_topic_requests(request):
    cover_image_column = topic_cover_column_name()
    ensure_topic_request_support_tables()

    cursor = connection.cursor()

    cover_image_sql = f"t.{cover_image_column} AS COVER_IMAGE_PATH" if cover_image_column else "NULL AS COVER_IMAGE_PATH"

    cursor.execute(f"""
        SELECT
            t.TOPIC_ID,
            t.TITLE,
            t.DESCRIPTION,
            t.CREATED_AT,
            t.CREATED_BY,
            u.FIRST_NAME,
            u.LAST_NAME,
            c.CATEGORY_NAME,
            t.STATUS,
            m.PROOF_TEXT,
            m.ADMIN_FEEDBACK,
            {cover_image_sql}
        FROM TOPIC t
        JOIN USER u ON t.CREATED_BY = u.USER_ID
        JOIN CATEGORY c ON t.CATEGORY_ID = c.CATEGORY_ID
        LEFT JOIN TOPIC_REQUEST_META m ON m.TOPIC_ID = t.TOPIC_ID
        WHERE t.STATUS IN ('pending', 'needs_more_info')
        ORDER BY t.CREATED_AT DESC
    """)

    columns = [col[0] for col in cursor.description]
    data = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for row in data:
        row["COVER_IMAGE_PATH"] = build_media_url(row.get("COVER_IMAGE_PATH"))

    return JsonResponse(data, safe=False)


def admin_topics(request):
    cover_image_column = topic_cover_column_name()
    ensure_topic_request_support_tables()

    cursor = connection.cursor()

    cover_image_sql = f"t.{cover_image_column} AS COVER_IMAGE_PATH" if cover_image_column else "NULL AS COVER_IMAGE_PATH"

    cursor.execute(f"""
        SELECT
            t.TOPIC_ID,
            t.TITLE,
            t.DESCRIPTION,
            t.CREATED_AT,
            t.STATUS,
            t.CREATED_BY,
            u.FIRST_NAME,
            u.LAST_NAME,
            c.CATEGORY_NAME,
            m.ADMIN_FEEDBACK,
            {cover_image_sql}
        FROM TOPIC t
        JOIN USER u ON t.CREATED_BY = u.USER_ID
        JOIN CATEGORY c ON t.CATEGORY_ID = c.CATEGORY_ID
        LEFT JOIN TOPIC_REQUEST_META m ON m.TOPIC_ID = t.TOPIC_ID
        WHERE t.STATUS IN ('approved', 'inactive', 'hidden')
        ORDER BY t.CREATED_AT DESC
    """)

    columns = [col[0] for col in cursor.description]
    data = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for row in data:
        row["COVER_IMAGE_PATH"] = build_media_url(row.get("COVER_IMAGE_PATH"))

    return JsonResponse(data, safe=False)


@csrf_exempt
def approve_topic_request(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            topic_id = data.get("topic_id")
            admin_user_id = data.get("admin_user_id")

            cursor = connection.cursor()
            cursor.execute("""
                SELECT TOPIC_ID, TITLE, CREATED_BY
                FROM TOPIC
                WHERE TOPIC_ID=%s
                  AND STATUS IN ('pending', 'needs_more_info')
            """, [topic_id])

            topic_row = cursor.fetchone()

            if not topic_row:
                return JsonResponse({"success": False, "message": "Topic not found"})

            topic_id_value, topic_title, student_id = topic_row

            cursor.execute("""
                UPDATE TOPIC
                SET STATUS='approved'
                WHERE TOPIC_ID=%s
            """, [topic_id])
            upsert_topic_request_meta(topic_id_value, admin_feedback=None)
            add_topic_request_timeline(topic_id_value, "approved", f'Admin approved the topic request "{topic_title}".')
            log_admin_activity(admin_user_id, "approve_topic_request", "topic_request", topic_id_value, f'Approved topic request "{topic_title}".')

            cursor.execute("""
                INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                VALUES (%s, %s, 0)
            """, [
                student_id,
                f'topic_request_approved|{topic_id_value}|Your topic request "{topic_title}" has been approved.'
            ])

            return JsonResponse({"success": True})
        except Exception as e:
            print("APPROVE TOPIC REQUEST ERROR:", e)
            return JsonResponse({"success": False})

    return JsonResponse({"success": False, "message": "POST only"})


@csrf_exempt
def toggle_topic_status(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        data = json.loads(request.body)
        topic_id = data.get("topic_id")
        admin_user_id = data.get("admin_user_id")

        cursor = connection.cursor()
        cursor.execute("""
            SELECT STATUS
            FROM TOPIC
            WHERE TOPIC_ID = %s
        """, [topic_id])

        row = cursor.fetchone()
        if not row:
            return JsonResponse({"success": False, "message": "Topic not found"})

        requested_status = str(data.get("status") or "").strip().lower()
        allowed_statuses = {"approved", "inactive", "hidden"}

        if requested_status in allowed_statuses:
            next_status = requested_status
        else:
            next_status = "inactive" if row[0] == "approved" else "approved"

        cursor.execute("""
            UPDATE TOPIC
            SET STATUS = %s
            WHERE TOPIC_ID = %s
        """, [next_status, topic_id])
        log_admin_activity(admin_user_id, "toggle_topic_status", "topic", topic_id, f"Changed topic moderation status to {next_status}.")

        return JsonResponse({"success": True, "status": next_status})
    except Exception as e:
        print("TOGGLE TOPIC STATUS ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not update topic status"})


@csrf_exempt
def reject_topic_request(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            topic_id = data.get("topic_id")
            feedback = data.get("feedback")
            admin_user_id = data.get("admin_user_id")

            cursor = connection.cursor()
            cursor.execute("""
                SELECT TOPIC_ID, TITLE, CREATED_BY
                FROM TOPIC
                WHERE TOPIC_ID=%s
                  AND STATUS IN ('pending', 'needs_more_info')
            """, [topic_id])

            topic_row = cursor.fetchone()

            if not topic_row:
                return JsonResponse({"success": False, "message": "Topic not found"})

            topic_id_value, topic_title, student_id = topic_row

            cursor.execute("""
                UPDATE TOPIC
                SET STATUS='rejected'
                WHERE TOPIC_ID=%s
            """, [topic_id])
            upsert_topic_request_meta(topic_id_value, admin_feedback=feedback)
            add_topic_request_timeline(topic_id_value, "rejected", f'Admin rejected the topic request "{topic_title}".')
            log_admin_activity(admin_user_id, "reject_topic_request", "topic_request", topic_id_value, f'Rejected topic request "{topic_title}".')

            rejection_message = f'Your topic request "{topic_title}" has been rejected.'
            if feedback:
                rejection_message = f'{rejection_message} Reason: {feedback}'

            cursor.execute("""
                INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                VALUES (%s, %s, 0)
            """, [
                student_id,
                f'topic_request_rejected|{topic_id_value}|{rejection_message}'
            ])

            return JsonResponse({"success": True})
        except Exception as e:
            print("REJECT TOPIC REQUEST ERROR:", e)
            return JsonResponse({"success": False})

    return JsonResponse({"success": False, "message": "POST only"})


@csrf_exempt
def delete_topic_request(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            topic_id = data.get("topic_id")
            admin_user_id = data.get("admin_user_id")

            cursor = connection.cursor()
            cursor.execute("""
                SELECT TITLE
                FROM TOPIC
                WHERE TOPIC_ID=%s
            """, [topic_id])
            row = cursor.fetchone()

            cursor.execute("""
                DELETE FROM TOPIC
                WHERE TOPIC_ID=%s AND STATUS IN ('pending', 'needs_more_info')
            """, [topic_id])

            if row:
                log_admin_activity(admin_user_id, "delete_topic_request", "topic_request", topic_id, f'Deleted topic request "{row[0]}".')

            return JsonResponse({"success": True})
        except Exception as e:
            print("DELETE TOPIC REQUEST ERROR:", e)
            return JsonResponse({"success": False})

    return JsonResponse({"success": False, "message": "POST only"})


@csrf_exempt
def request_more_topic_info(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        data = json.loads(request.body)
        topic_id = data.get("topic_id")
        feedback = str(data.get("feedback") or "").strip()
        admin_user_id = data.get("admin_user_id")

        if not feedback:
            return JsonResponse({"success": False, "message": "Please provide details for the student"})

        cursor = connection.cursor()
        cursor.execute("""
            SELECT TOPIC_ID, TITLE, CREATED_BY
            FROM TOPIC
            WHERE TOPIC_ID = %s
              AND STATUS = 'pending'
        """, [topic_id])
        topic_row = cursor.fetchone()

        if not topic_row:
            return JsonResponse({"success": False, "message": "Topic request not found"})

        topic_id_value, topic_title, student_id = topic_row

        cursor.execute("""
            UPDATE TOPIC
            SET STATUS = 'needs_more_info'
            WHERE TOPIC_ID = %s
        """, [topic_id])
        upsert_topic_request_meta(topic_id_value, admin_feedback=feedback)
        add_topic_request_timeline(topic_id_value, "needs_more_info", f'Admin requested more information for "{topic_title}".')
        log_admin_activity(admin_user_id, "request_more_info", "topic_request", topic_id_value, f'Requested more information for "{topic_title}".')

        cursor.execute("""
            INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
            VALUES (%s, %s, 0)
        """, [
            student_id,
            f'topic_request_more_info|{topic_id_value}|Your topic request "{topic_title}" needs more information. Details: {feedback}'
        ])

        return JsonResponse({"success": True})
    except Exception as e:
        print("REQUEST MORE TOPIC INFO ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not request more information"})


def topic_request_timelines(request, user_id):
    try:
        ensure_topic_request_support_tables()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT tt.TIMELINE_ID, tt.TOPIC_ID, tt.EVENT_TYPE, tt.EVENT_MESSAGE, tt.CREATED_AT
            FROM TOPIC_REQUEST_TIMELINE tt
            JOIN TOPIC t ON t.TOPIC_ID = tt.TOPIC_ID
            WHERE t.CREATED_BY = %s
            ORDER BY tt.CREATED_AT ASC
        """, [user_id])
        columns = [col[0] for col in cursor.description]
        data = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return JsonResponse(data, safe=False)
    except Exception as e:
        print("TOPIC REQUEST TIMELINES ERROR:", e)
        return JsonResponse([], safe=False)


@csrf_exempt
def report_content(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        ensure_topic_request_support_tables()
        data = json.loads(request.body)
        reporter_id = data.get("reporter_id")
        target_type = str(data.get("target_type") or "").strip().lower()
        target_id = data.get("target_id")
        reason = str(data.get("reason") or "").strip()
        details = str(data.get("details") or "").strip()

        if target_type not in {"topic", "reply"}:
            return JsonResponse({"success": False, "message": "Invalid report target"})
        if not reporter_id or not target_id or not reason:
            return JsonResponse({"success": False, "message": "Missing report details"})

        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO CONTENT_REPORT (REPORTER_ID, TARGET_TYPE, TARGET_ID, REASON, DETAILS)
            VALUES (%s, %s, %s, %s, %s)
        """, [reporter_id, target_type, target_id, reason, details or None])

        if target_type == "reply":
            cursor.execute("""
                SELECT t.TOPIC_ID, t.TITLE, t.CREATED_BY
                FROM POST p
                JOIN TOPIC t ON t.TOPIC_ID = p.TOPIC_ID
                WHERE p.POST_ID = %s
            """, [target_id])
            reply_context = cursor.fetchone()
            if reply_context:
                topic_id, topic_title, topic_owner_id = reply_context
                if str(topic_owner_id) != str(reporter_id):
                    cursor.execute("""
                        INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                        VALUES (%s, %s, 0)
                    """, [
                        topic_owner_id,
                        f'reported_reply_notice|{topic_id}:{target_id}|A reply in your topic "{topic_title}" was reported and sent to admin review.'
                    ])
        elif target_type == "topic":
            cursor.execute("""
                SELECT TOPIC_ID, TITLE, CREATED_BY
                FROM TOPIC
                WHERE TOPIC_ID = %s
            """, [target_id])
            topic_context = cursor.fetchone()
            if topic_context:
                topic_id, topic_title, topic_owner_id = topic_context
                if str(topic_owner_id) != str(reporter_id):
                    cursor.execute("""
                        INSERT INTO NOTIFICATION (USER_ID, CONTENT, IS_READ)
                        VALUES (%s, %s, 0)
                    """, [
                        topic_owner_id,
                        f'reported_topic_notice|{topic_id}|Your topic "{topic_title}" was reported and sent to admin review.'
                    ])
        return JsonResponse({"success": True})
    except Exception as e:
        print("REPORT CONTENT ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not submit report"})


def admin_reports(request):
    try:
        ensure_topic_request_support_tables()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT
                r.REPORT_ID,
                r.REPORTER_ID,
                r.TARGET_TYPE,
                r.TARGET_ID,
                r.REASON,
                r.DETAILS,
                r.STATUS,
                r.REVIEW_NOTES,
                r.ASSIGNED_ADMIN_ID,
                r.CREATED_AT,
                r.REVIEWED_AT,
                CONCAT(IFNULL(admin_user.FIRST_NAME, ''), ' ', IFNULL(admin_user.LAST_NAME, '')) AS ASSIGNED_ADMIN_NAME,
                CASE
                    WHEN r.TARGET_TYPE = 'topic' THEN t.TITLE
                    ELSE pt.TITLE
                END AS TARGET_TITLE,
                CASE
                    WHEN r.TARGET_TYPE = 'topic' THEN t.DESCRIPTION
                    ELSE p.CONTENT
                END AS TARGET_CONTENT,
                CASE
                    WHEN r.TARGET_TYPE = 'topic' THEN t.TOPIC_ID
                    ELSE pt.TOPIC_ID
                END AS NAV_TOPIC_ID
            FROM CONTENT_REPORT r
            LEFT JOIN TOPIC t
              ON r.TARGET_TYPE = 'topic' AND t.TOPIC_ID = r.TARGET_ID
            LEFT JOIN POST p
              ON r.TARGET_TYPE = 'reply' AND p.POST_ID = r.TARGET_ID
            LEFT JOIN TOPIC pt
              ON p.TOPIC_ID = pt.TOPIC_ID
            LEFT JOIN USER admin_user
              ON admin_user.USER_ID = r.ASSIGNED_ADMIN_ID
            WHERE r.TARGET_TYPE IN ('topic', 'reply')
            ORDER BY r.CREATED_AT DESC
        """)
        columns = [col[0] for col in cursor.description]
        data = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return JsonResponse(data, safe=False)
    except Exception as e:
        print("ADMIN REPORTS ERROR:", e)
        return JsonResponse([], safe=False)


@csrf_exempt
def moderate_reported_content(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        ensure_topic_request_support_tables()
        data = json.loads(request.body)
        report_id = data.get("report_id")
        admin_user_id = data.get("admin_user_id")
        notes = str(data.get("notes") or "").strip()

        if not report_id:
            return JsonResponse({"success": False, "message": "Missing report id"})

        cursor = connection.cursor()
        cursor.execute("""
            SELECT REPORT_ID, TARGET_TYPE, TARGET_ID
            FROM CONTENT_REPORT
            WHERE REPORT_ID = %s
        """, [report_id])
        report_row = cursor.fetchone()

        if not report_row:
            return JsonResponse({"success": False, "message": "Report not found"})

        _, target_type, target_id = report_row
        action_message = ""
        nav_topic_id = None

        normalized_target_type = str(target_type).lower()

        if normalized_target_type == "reply":
            cursor.execute("""
                SELECT TOPIC_ID
                FROM POST
                WHERE POST_ID = %s
            """, [target_id])
            post_row = cursor.fetchone()
            if not post_row:
                return JsonResponse({"success": False, "message": "Reply not found"})

            nav_topic_id = post_row[0]
            cursor.execute("""
                UPDATE POST
                SET IS_DELETED = 1
                WHERE POST_ID = %s
            """, [target_id])
            action_message = "Deleted reported reply."
        else:
            cursor.execute("""
                SELECT TOPIC_ID
                FROM TOPIC
                WHERE TOPIC_ID = %s
            """, [target_id])
            topic_row = cursor.fetchone()
            if not topic_row:
                return JsonResponse({"success": False, "message": "Topic not found"})

            nav_topic_id = topic_row[0]
            cursor.execute("""
                UPDATE TOPIC
                SET STATUS = 'hidden'
                WHERE TOPIC_ID = %s
            """, [target_id])
            action_message = "Hidden reported topic from users."

        review_notes = notes or action_message
        cursor.execute("""
            UPDATE CONTENT_REPORT
            SET STATUS = 'reviewed',
                REVIEW_NOTES = %s,
                REVIEWED_AT = CURRENT_TIMESTAMP
            WHERE REPORT_ID = %s
        """, [review_notes, report_id])

        log_admin_activity(admin_user_id, "remove_reported_content", target_type, target_id, action_message)
        log_admin_activity(admin_user_id, "resolve_report", "report", report_id, f"Removed reported {target_type}.")

        return JsonResponse({
            "success": True,
            "status": "reviewed",
            "reviewNotes": review_notes,
            "navTopicId": str(nav_topic_id) if nav_topic_id is not None else None,
            "targetType": target_type,
            "targetId": str(target_id),
        })
    except Exception as e:
        print("MODERATE REPORTED CONTENT ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not remove reported content"})


@csrf_exempt
def resolve_report(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        ensure_topic_request_support_tables()
        data = json.loads(request.body)
        report_id = data.get("report_id")
        status = str(data.get("status") or "").strip().lower()
        notes = str(data.get("notes") or "").strip()
        admin_user_id = data.get("admin_user_id")

        if status not in {"pending", "under_review", "action_taken", "dismissed"}:
            return JsonResponse({"success": False, "message": "Invalid report status"})

        cursor = connection.cursor()
        cursor.execute("""
            UPDATE CONTENT_REPORT
            SET STATUS = %s,
                REVIEW_NOTES = %s,
                ASSIGNED_ADMIN_ID = %s,
                REVIEWED_AT = CURRENT_TIMESTAMP
            WHERE REPORT_ID = %s
        """, [status, notes or None, admin_user_id, report_id])
        log_admin_activity(admin_user_id, "resolve_report", "report", report_id, f"Marked report as {status}.")

        cursor.execute("""
            SELECT CONCAT(IFNULL(FIRST_NAME, ''), ' ', IFNULL(LAST_NAME, ''))
            FROM USER
            WHERE USER_ID = %s
        """, [admin_user_id])
        admin_row = cursor.fetchone()

        return JsonResponse({
            "success": True,
            "status": status,
            "assignedAdminId": str(admin_user_id) if admin_user_id is not None else None,
            "assignedAdminName": (admin_row[0].strip() if admin_row and admin_row[0] else None),
            "reviewedAt": None,
        })
    except Exception as e:
        print("RESOLVE REPORT ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not resolve report"})


def admin_activity_log(request):
    try:
        ensure_topic_request_support_tables()
        cursor = connection.cursor()
        cursor.execute("""
            SELECT LOG_ID, ADMIN_USER_ID, ACTION_TYPE, TARGET_TYPE, TARGET_ID, DESCRIPTION, CREATED_AT
            FROM ADMIN_ACTIVITY_LOG
            ORDER BY CREATED_AT DESC
            LIMIT 200
        """)
        columns = [col[0] for col in cursor.description]
        data = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return JsonResponse(data, safe=False)
    except Exception as e:
        print("ADMIN ACTIVITY LOG ERROR:", e)
        return JsonResponse([], safe=False)


def build_weekly_trend_lookup(cursor, query, params=None):
    cursor.execute(query, params or [])
    return {
        str(row[0]): int(row[1] or 0)
        for row in cursor.fetchall()
    }


def admin_insights(request):
    try:
        ensure_topic_request_support_tables()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT COUNT(*)
            FROM TOPIC
            WHERE STATUS = 'pending'
        """)
        pending_requests = int(cursor.fetchone()[0] or 0)

        cursor.execute("""
            SELECT COUNT(*)
            FROM CONTENT_REPORT
            WHERE STATUS = 'pending'
        """)
        pending_reports = int(cursor.fetchone()[0] or 0)

        cursor.execute("""
            SELECT COUNT(DISTINCT user_id)
            FROM (
                SELECT CREATED_BY AS user_id
                FROM TOPIC
                WHERE CREATED_AT >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION ALL
                SELECT CREATED_BY AS user_id
                FROM POST
                WHERE CREATED_AT >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                  AND IFNULL(IS_DELETED, 0) = 0
                UNION ALL
                SELECT SENDER_ID AS user_id
                FROM MESSAGE
                WHERE SENT_AT >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                UNION ALL
                SELECT RECEIVER_ID AS user_id
                FROM MESSAGE
                WHERE SENT_AT >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ) active_people
            WHERE user_id IS NOT NULL
        """)
        active_users_30d = int(cursor.fetchone()[0] or 0)

        cursor.execute("""
            SELECT
                ROUND(AVG(TIMESTAMPDIFF(HOUR, t.CREATED_AT, timeline.first_review_at)), 1)
            FROM TOPIC t
            JOIN (
                SELECT TOPIC_ID, MIN(CREATED_AT) AS first_review_at
                FROM TOPIC_REQUEST_TIMELINE
                WHERE EVENT_TYPE IN ('approved', 'rejected', 'needs_more_info')
                GROUP BY TOPIC_ID
            ) timeline
              ON timeline.TOPIC_ID = t.TOPIC_ID
        """)
        avg_request_turnaround_hours = float(cursor.fetchone()[0] or 0)

        cursor.execute("""
            SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, CREATED_AT, REVIEWED_AT)), 1)
            FROM CONTENT_REPORT
            WHERE REVIEWED_AT IS NOT NULL
        """)
        avg_report_resolution_hours = float(cursor.fetchone()[0] or 0)

        cursor.execute("""
            SELECT COUNT(*)
            FROM CONTENT_REPORT
            WHERE CREATED_AT >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """)
        reports_last_7_days = int(cursor.fetchone()[0] or 0)

        cursor.execute("""
            SELECT COUNT(*)
            FROM CONTENT_REPORT
            WHERE CREATED_AT >= DATE_SUB(NOW(), INTERVAL 14 DAY)
              AND CREATED_AT < DATE_SUB(NOW(), INTERVAL 7 DAY)
        """)
        reports_previous_7_days = int(cursor.fetchone()[0] or 0)

        cursor.execute("""
            SELECT COUNT(*)
            FROM TOPIC_REQUEST_TIMELINE
            WHERE EVENT_TYPE = 'approved'
              AND CREATED_AT >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        """)
        approvals_last_30_days = int(cursor.fetchone()[0] or 0)

        cursor.execute("""
            SELECT c.CATEGORY_NAME, COUNT(*) AS topic_count
            FROM TOPIC t
            JOIN CATEGORY c ON c.CATEGORY_ID = t.CATEGORY_ID
            WHERE t.STATUS IN ('approved', 'inactive', 'hidden')
            GROUP BY c.CATEGORY_NAME
            ORDER BY topic_count DESC, c.CATEGORY_NAME ASC
            LIMIT 5
        """)
        top_categories = [
            {
                "name": row[0],
                "topicCount": int(row[1] or 0),
            }
            for row in cursor.fetchall()
        ]

        return JsonResponse({
            "activeUsers30d": active_users_30d,
            "pendingReports": pending_reports,
            "pendingRequests": pending_requests,
            "avgRequestTurnaroundHours": avg_request_turnaround_hours,
            "avgReportResolutionHours": avg_report_resolution_hours,
            "reportsLast7Days": reports_last_7_days,
            "reportsPrevious7Days": reports_previous_7_days,
            "approvalsLast30Days": approvals_last_30_days,
            "topCategories": top_categories,
        })
    except Exception as e:
        print("ADMIN INSIGHTS ERROR:", e)
        return JsonResponse({
            "activeUsers30d": 0,
            "pendingReports": 0,
            "pendingRequests": 0,
            "avgRequestTurnaroundHours": 0,
            "avgReportResolutionHours": 0,
            "reportsLast7Days": 0,
            "reportsPrevious7Days": 0,
            "approvalsLast30Days": 0,
            "topCategories": [],
        })


def admin_trends(request):
    try:
        ensure_topic_request_support_tables()
        cursor = connection.cursor()
        week_count = 6
        today = timezone.now().date()
        current_week_start = today - timedelta(days=today.weekday())
        start_week = current_week_start - timedelta(weeks=week_count - 1)

        posts_lookup = build_weekly_trend_lookup(cursor, """
            SELECT
                DATE_FORMAT(DATE_SUB(DATE(CREATED_AT), INTERVAL WEEKDAY(CREATED_AT) DAY), '%%Y-%%m-%%d') AS week_start,
                COUNT(*) AS total
            FROM TOPIC
            WHERE CREATED_AT >= %s
            GROUP BY week_start
        """, [start_week])

        replies_lookup = build_weekly_trend_lookup(cursor, """
            SELECT
                DATE_FORMAT(DATE_SUB(DATE(CREATED_AT), INTERVAL WEEKDAY(CREATED_AT) DAY), '%%Y-%%m-%%d') AS week_start,
                COUNT(*) AS total
            FROM POST
            WHERE CREATED_AT >= %s
              AND PARENT_POST_ID IS NOT NULL
              AND IFNULL(IS_DELETED, 0) = 0
            GROUP BY week_start
        """, [start_week])

        reports_lookup = build_weekly_trend_lookup(cursor, """
            SELECT
                DATE_FORMAT(DATE_SUB(DATE(CREATED_AT), INTERVAL WEEKDAY(CREATED_AT) DAY), '%%Y-%%m-%%d') AS week_start,
                COUNT(*) AS total
            FROM CONTENT_REPORT
            WHERE CREATED_AT >= %s
            GROUP BY week_start
        """, [start_week])

        approvals_lookup = build_weekly_trend_lookup(cursor, """
            SELECT
                DATE_FORMAT(DATE_SUB(DATE(CREATED_AT), INTERVAL WEEKDAY(CREATED_AT) DAY), '%%Y-%%m-%%d') AS week_start,
                COUNT(*) AS total
            FROM TOPIC_REQUEST_TIMELINE
            WHERE EVENT_TYPE = 'approved'
              AND CREATED_AT >= %s
            GROUP BY week_start
        """, [start_week])

        active_users_lookup = build_weekly_trend_lookup(cursor, """
            SELECT week_start, COUNT(DISTINCT user_id) AS total
            FROM (
                SELECT
                    DATE_FORMAT(DATE_SUB(DATE(CREATED_AT), INTERVAL WEEKDAY(CREATED_AT) DAY), '%%Y-%%m-%%d') AS week_start,
                    CREATED_BY AS user_id
                FROM TOPIC
                WHERE CREATED_AT >= %s
                UNION ALL
                SELECT
                    DATE_FORMAT(DATE_SUB(DATE(CREATED_AT), INTERVAL WEEKDAY(CREATED_AT) DAY), '%%Y-%%m-%%d') AS week_start,
                    CREATED_BY AS user_id
                FROM POST
                WHERE CREATED_AT >= %s
                  AND IFNULL(IS_DELETED, 0) = 0
                UNION ALL
                SELECT
                    DATE_FORMAT(DATE_SUB(DATE(SENT_AT), INTERVAL WEEKDAY(SENT_AT) DAY), '%%Y-%%m-%%d') AS week_start,
                    SENDER_ID AS user_id
                FROM MESSAGE
                WHERE SENT_AT >= %s
                UNION ALL
                SELECT
                    DATE_FORMAT(DATE_SUB(DATE(SENT_AT), INTERVAL WEEKDAY(SENT_AT) DAY), '%%Y-%%m-%%d') AS week_start,
                    RECEIVER_ID AS user_id
                FROM MESSAGE
                WHERE SENT_AT >= %s
            ) weekly_activity
            WHERE user_id IS NOT NULL
            GROUP BY week_start
        """, [start_week, start_week, start_week, start_week])

        weekly_trends = []
        for offset in range(week_count):
            week_start = start_week + timedelta(weeks=offset)
            week_key = week_start.strftime("%Y-%m-%d")
            weekly_trends.append({
                "weekStart": week_key,
                "label": week_start.strftime("%b %d"),
                "posts": posts_lookup.get(week_key, 0),
                "replies": replies_lookup.get(week_key, 0),
                "reports": reports_lookup.get(week_key, 0),
                "approvals": approvals_lookup.get(week_key, 0),
                "activeUsers": active_users_lookup.get(week_key, 0),
            })

        return JsonResponse(weekly_trends, safe=False)
    except Exception as e:
        print("ADMIN TRENDS ERROR:", e)
        return JsonResponse([], safe=False)


def notifications(request, user_id):

    cursor = connection.cursor()
    cursor.execute("""
        SELECT NOTIFICATION_ID, USER_ID, CONTENT, IS_READ, CREATED_AT
        FROM NOTIFICATION
        WHERE USER_ID=%s
        ORDER BY CREATED_AT DESC
    """, [user_id])

    data = [build_notification_payload(row) for row in cursor.fetchall()]
    return JsonResponse(data, safe=False)


@csrf_exempt
def mark_notification_read(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            notification_id = data.get("notification_id")

            cursor = connection.cursor()
            cursor.execute("""
                UPDATE NOTIFICATION
                SET IS_READ = 1
                WHERE NOTIFICATION_ID=%s
            """, [notification_id])

            return JsonResponse({"success": True})
        except Exception as e:
            print("MARK NOTIFICATION READ ERROR:", e)
            return JsonResponse({"success": False})

    return JsonResponse({"success": False, "message": "POST only"})


@csrf_exempt
def mark_all_notifications_read(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("user_id")

            cursor = connection.cursor()
            cursor.execute("""
                UPDATE NOTIFICATION
                SET IS_READ = 1
                WHERE USER_ID=%s
            """, [user_id])

            return JsonResponse({"success": True})
        except Exception as e:
            print("MARK ALL NOTIFICATIONS READ ERROR:", e)
            return JsonResponse({"success": False})

    return JsonResponse({"success": False, "message": "POST only"})


@csrf_exempt
def delete_notification(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            notification_id = data.get("notification_id")

            cursor = connection.cursor()
            cursor.execute("""
                DELETE FROM NOTIFICATION
                WHERE NOTIFICATION_ID=%s
            """, [notification_id])

            return JsonResponse({"success": True})
        except Exception as e:
            print("DELETE NOTIFICATION ERROR:", e)
            return JsonResponse({"success": False})

    return JsonResponse({"success": False, "message": "POST only"})

@csrf_exempt
def toggle_user_status(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")

        cursor = connection.cursor()
        cursor.execute("""
            UPDATE USER
            SET IS_ACTIVE = NOT IS_ACTIVE
            WHERE USER_ID=%s
        """, [user_id])
        cursor.execute("""
            SELECT IS_ACTIVE
            FROM USER
            WHERE USER_ID=%s
        """, [user_id])
        row = cursor.fetchone()

        return JsonResponse({
            "success": True,
            "isActive": bool(row[0]) if row else None,
        })
    except Exception as e:
        print("TOGGLE USER STATUS ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not update user status"})
    
@csrf_exempt
def delete_user(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "message": "POST only"})

    try:
        data = json.loads(request.body)
        user_id = data.get("user_id")

        cursor = connection.cursor()

        # soft delete instead of hard delete
        cursor.execute("""
            UPDATE USER
            SET IS_ACTIVE = 0
            WHERE USER_ID=%s
        """, [user_id])

        return JsonResponse({"success": True})
    except Exception as e:
        print("DELETE USER ERROR:", e)
        return JsonResponse({"success": False, "message": "Could not disable user"})

def faculty_requests(request):

    cursor = connection.cursor()

    cursor.execute("""
        SELECT USER_ID, FIRST_NAME, LAST_NAME, EMAIL
        FROM USER
        WHERE ROLE='faculty' AND STATUS='pending'
    """)

    columns = [col[0] for col in cursor.description]
    data = [dict(zip(columns, row)) for row in cursor.fetchall()]

    return JsonResponse(data, safe=False)

@csrf_exempt
def approve_faculty(request):

    data = json.loads(request.body)
    user_id = data.get("user_id")

    cursor = connection.cursor()

    cursor.execute("""
        UPDATE USER
        SET STATUS='approved', IS_ACTIVE=1
        WHERE USER_ID=%s
    """, [user_id])

    return JsonResponse({"success": True})
