---
paths:
  - "**/pom.xml"
---

# POM

- Version dependency khai báo ở `<properties>` của parent `pom.xml`; module con không hardcode version.
- Thêm / đổi dependency phải hỏi trước và nói rõ lý do.
- `conghung-commons` lấy từ GitHub Packages — đổi version phải xác nhận artifact tồn tại trước.
- Sau khi sửa pom: `mvn -q clean compile -DskipTests`, rồi `mvn clean verify -B -DskipTests=false`.
