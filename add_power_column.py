#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
資料庫遷移腳本：新增 power_w 欄位
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'instance', 'windmill.db')

print(f"[INFO] 資料庫路徑: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 檢查欄位是否已存在
    cursor.execute("PRAGMA table_info(device_data)")
    columns = [row[1] for row in cursor.fetchall()]

    print(f"[INFO] 現有欄位: {', '.join(columns)}")

    if 'power_w' in columns:
        print("[OK] power_w 欄位已存在，無需新增")
    else:
        print("[INFO] 正在新增 power_w 欄位...")
        cursor.execute("ALTER TABLE device_data ADD COLUMN power_w REAL")
        conn.commit()
        print("[OK] power_w 欄位新增成功！")

    # 更新所有現有數據的功率值
    print("[INFO] 正在計算現有數據的功率值...")
    cursor.execute("""
        UPDATE device_data
        SET power_w = voltage_v * current_a
        WHERE voltage_v IS NOT NULL AND current_a IS NOT NULL AND power_w IS NULL
    """)
    updated = cursor.rowcount
    conn.commit()
    print(f"[OK] 已更新 {updated} 筆數據的功率值")

    conn.close()
    print("\n[SUCCESS] 資料庫遷移完成！")

except Exception as e:
    print(f"[ERROR] 錯誤: {e}")
