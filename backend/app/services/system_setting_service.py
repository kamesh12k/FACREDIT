from sqlalchemy.orm import Session
from app.models.system_setting import SystemSetting

def get_setting(db: Session, key: str, default: str = None) -> str:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    return row.value if row else default

def set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not row:
        row = SystemSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
