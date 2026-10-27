FROM nginx:alpine

COPY --chown=nginx:nginx index.html style.css script.js /usr/share/nginx/html/
COPY --chown=nginx:nginx default.conf.template /etc/nginx/templates/

RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

USER 101:101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
