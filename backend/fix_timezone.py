#!/usr/bin/env python3
"""
修正資料庫中的時區問題
將所有沒有時區信息的 datetime 視為 UTC，並加上時區標記
"""
import os
import sys
from datetime import timezone, timedelta
from sqlalchemy import create_engine
from app import app, db, DeviceData, TAIWAN_TZ

print("=" * 70)
print("資料庫時區修正工具")
print("=" * 70)

with app.app_context():
    # 查詢所有數據
    all_data = DeviceData.query.all()
    print(f"找到 {len(all_data)} 筆數據")

    if len(all_data) == 0:
        print("沒有數據需要修正")
        sys.exit(0)

    # 顯示前3筆數據的時間
    print("\n前3筆數據的時間:")
    for i, record in enumerate(all_data[:3]):
        print(f"{i+1}. ID={record.id}, timestamp={record.timestamp}, tzinfo={record.timestamp.tzinfo}")

    # 詢問是否要修正
    print("\n是否要清除所有數據並重新開始？(y/N): ", end='')
    response = input().strip().lower()

    if response == 'y':
        # 清除所有數據
        count = DeviceData.query.delete()
        db.session.commit()
        print(f"✓ 已清除 {count} 筆數據")
        print("建議：重新執行 simulator 產生新的測試數據")
    else:
        print("取消操作")

print("=" * 70)
