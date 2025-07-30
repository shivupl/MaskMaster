# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.9.12

FROM python:${PYTHON_VERSION}-slim

LABEL fly_launch_runtime="flask"

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /code

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

COPY . .

ENV FLASK_APP=app.py

EXPOSE 8080

# CMD [ "python3", "-m" , "flask", "run", "--host=0.0.0.0", "--port=8080"]
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app"]
