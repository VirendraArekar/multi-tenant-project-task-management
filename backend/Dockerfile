# Build stage
FROM eclipse-temurin:25-jdk AS builder
WORKDIR /workspace

# Install Maven
RUN apt-get update && apt-get install -y --no-install-recommends maven && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:25-jre AS runner
WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 teamboard && \
    useradd -u 1001 -g teamboard -s /bin/bash -m teamboard

COPY --from=builder --chown=teamboard:teamboard /workspace/target/*.jar app.jar

USER teamboard:teamboard

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseZGC -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
